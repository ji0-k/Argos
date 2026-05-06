import threading
import logging
import os
import time
import cv2
from datetime import datetime
from config import Config

logger = logging.getLogger(__name__)


class DetectionManager:
    """감지 세션을 관리하는 매니저 - 로컬 YOLO 추론"""

    DB_SAVE_INTERVAL = 60  # 초

    def __init__(self):
        self._threads: dict[int, threading.Thread] = {}
        self._running: dict[int, bool] = {}
        self._last_saved: dict[int, dict] = {}  # {cctv_id: {type: timestamp}}

    def start(self, cctv_id: int, session_id: int, stream_url: str, app):
        """백그라운드 스레드에서 감지 루프 시작"""
        if cctv_id in self._running and self._running[cctv_id]:
            logger.warning(f"이미 감지 중 (cctv_id={cctv_id})")
            return

        self._running[cctv_id] = True
        thread = threading.Thread(
            target=self._detection_loop,
            args=(cctv_id, session_id, stream_url, app),
            daemon=True,
        )
        self._threads[cctv_id] = thread
        thread.start()
        logger.info(f"감지 시작 (cctv_id={cctv_id}, session_id={session_id})")

    def stop(self, cctv_id: int):
        """감지 루프 중지"""
        self._running[cctv_id] = False
        from services.inference import LATEST_BOXES
        LATEST_BOXES.pop(cctv_id, None)
        logger.info(f"감지 중지 요청 (cctv_id={cctv_id})")

    def _detection_loop(self, cctv_id: int, session_id: int, stream_url: str, app):
        """프레임별 YOLO 추론 루프"""
        from services.inference import infer_fire_smoke, infer_vehicle

        cap = cv2.VideoCapture(stream_url)
        frame_interval = 2.0  # 2초마다 추론

        with app.app_context():
            while self._running.get(cctv_id, False):
                ret, frame = cap.read()
                if not ret:
                    time.sleep(1)
                    continue

                try:
                    fire_result = infer_fire_smoke(frame)
                    vehicle_result = infer_vehicle(frame, cctv_id)

                    for result in [fire_result, vehicle_result]:
                        if result and result.get("type") != "normal":
                            self._maybe_save(cctv_id, session_id, result, frame)

                except Exception as e:
                    logger.error(f"감지 루프 오류: {e}")

                time.sleep(frame_interval)

        cap.release()

    def _maybe_save(self, cctv_id: int, session_id: int, result: dict, frame):
        det_type = result.get("type")
        now = time.time()
        last = self._last_saved.setdefault(cctv_id, {})
        if now - last.get(det_type, 0) < self.DB_SAVE_INTERVAL:
            return
        last[det_type] = now
        self._handle_detection(cctv_id, session_id, result, frame)

    def _handle_detection(self, cctv_id: int, session_id: int, result: dict, frame):
        """이상 감지 시 DB 저장 + WebSocket 알림"""
        from models.db import db, DetectionLog, CctvList
        from app import socketio

        detection_type = result.get("type")
        confidence = result.get("confidence", 0.0)

        snapshot_path = self._save_snapshot(frame, cctv_id, detection_type)
        cctv = CctvList.query.get(cctv_id)

        log = DetectionLog(
            cctv_id=cctv_id,
            session_id=session_id,
            type=detection_type,
            confidence=confidence,
            snapshot_path=snapshot_path,
        )
        db.session.add(log)
        db.session.commit()

        socketio.emit("alert", {
            "cctv_id": cctv_id,
            "cctv_name": cctv.name if cctv else f"CCTV #{cctv_id}",
            "type": detection_type,
            "confidence": confidence,
            "detected_at": datetime.utcnow().isoformat(),
            "snapshot_path": snapshot_path,
        })

    @staticmethod
    def _save_snapshot(frame, cctv_id: int, detection_type: str) -> str:
        """감지 시 스냅샷 이미지 저장"""
        os.makedirs(Config.CAPTURES_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_cctv{cctv_id}_{detection_type}.jpg"
        filepath = os.path.join(Config.CAPTURES_DIR, filename)
        cv2.imwrite(filepath, frame)
        return filepath
