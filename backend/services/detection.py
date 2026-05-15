import threading
import logging
import os
import time
import cv2
from datetime import datetime
from config import Config

logger = logging.getLogger(__name__)

# 감지 유형별 알림/저장 신뢰도 임계값
CONFIDENCE_THRESHOLD = {
    "fire": 0.7,
    "stopped_vehicle": 0.7,
    "congestion": 0.4,
}


def _drain_and_read(cap, drain=8):
    """버퍼에 쌓인 오래된 프레임을 버리고 최신 프레임 반환.

    cap.read()를 2초마다 한 번만 호출하면 버퍼에 ~50프레임이 쌓인다.
    grab()으로 빠르게 스킵한 뒤 retrieve()로 최신 프레임만 디코딩한다.
    """
    grabbed = False
    for _ in range(drain):
        if not cap.grab():
            break
        grabbed = True
    if grabbed:
        return cap.retrieve()
    return cap.read()


class DetectionManager:
    """감지 세션을 관리하는 매니저 - 로컬 YOLO 추론"""

    DB_SAVE_INTERVAL = 60  # 초

    def __init__(self):
        self._threads: dict[int, threading.Thread] = {}
        self._running: dict[int, bool] = {}
        self._connected: dict[int, bool] = {}
        self._last_saved: dict[int, dict] = {}

    def start(self, cctv_id: int, session_id: int, stream_url: str, app, cctv_name: str = ""):
        if cctv_id in self._running and self._running[cctv_id]:
            logger.warning(f"이미 감지 중 (cctv_id={cctv_id})")
            return

        self._running[cctv_id] = True
        thread = threading.Thread(
            target=self._detection_loop,
            args=(cctv_id, session_id, stream_url, app, cctv_name),
            daemon=True,
        )
        self._threads[cctv_id] = thread
        thread.start()
        logger.info(f"감지 시작 (cctv_id={cctv_id}, session_id={session_id})")

    def stop(self, cctv_id: int):
        self._running[cctv_id] = False
        from services.inference import LATEST_BOXES
        LATEST_BOXES.pop(cctv_id, None)
        logger.info(f"감지 중지 요청 (cctv_id={cctv_id})")

    RETRY_LIMIT = 10
    RETRY_PAUSE = 300

    def _detection_loop(self, cctv_id: int, session_id: int, stream_url: str, app, cctv_name: str = ""):
        from services.inference import infer_fire_smoke, infer_vehicle

        cap = cv2.VideoCapture(stream_url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # 버퍼 최소화
        frame_interval = 2.0
        fail_count = 0

        with app.app_context():
            while self._running.get(cctv_id, False):
                ret, frame = _drain_and_read(cap)

                if not ret:
                    fail_count += 1
                    self._connected[cctv_id] = False
                    if fail_count >= self.RETRY_LIMIT:
                        logger.warning(f"스트림 {fail_count}회 실패 (id={cctv_id}) — {self.RETRY_PAUSE}초 후 재시도")
                        cap.release()
                        time.sleep(self.RETRY_PAUSE)
                        cap = cv2.VideoCapture(stream_url)
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                        fail_count = 0
                    else:
                        time.sleep(1)
                    continue

                fail_count = 0
                self._connected[cctv_id] = True

                try:
                    fire_result = infer_fire_smoke(frame)
                    vehicle_result = infer_vehicle(frame, cctv_id)

                    for result in [fire_result, vehicle_result]:
                        if not result or result.get("type") == "normal":
                            continue
                        det_type = result.get("type")
                        threshold = CONFIDENCE_THRESHOLD.get(det_type, 0.7)
                        if result.get("confidence", 0.0) >= threshold:
                            self._emit_alert(cctv_id, result, cctv_name)
                            self._maybe_save(cctv_id, session_id, result, frame)

                except Exception as e:
                    logger.error(f"감지 루프 오류: {e}")

                time.sleep(frame_interval)  # eventlet이 패치 → 이 sleep 동안 HTTP 처리

        cap.release()

    def _emit_alert(self, cctv_id: int, result: dict, cctv_name: str = ""):
        from shared import alert_queue
        data = {
            "cctv_id": cctv_id,
            "cctv_name": cctv_name or f"CCTV #{cctv_id}",
            "type": result.get("type"),
            "confidence": result.get("confidence", 0.0),
            "detected_at": datetime.utcnow().isoformat() + "Z",
        }
        alert_queue.put(data)
        logger.info(f"[WS] Queue에 알림 추가: type={data['type']}, cctv_id={cctv_id}")
        print(f"[WS] Queue에 알림 추가: type={data['type']}", flush=True)

    def _maybe_save(self, cctv_id: int, session_id: int, result: dict, frame):
        det_type = result.get("type")
        confidence = result.get("confidence", 0.0)
        threshold = CONFIDENCE_THRESHOLD.get(det_type, 0.7)

        if confidence < threshold:
            return

        now = time.time()
        last = self._last_saved.setdefault(cctv_id, {})
        if now - last.get(det_type, 0) < self.DB_SAVE_INTERVAL:
            return
        last[det_type] = now
        self._handle_detection(cctv_id, session_id, result, frame)

    def _handle_detection(self, cctv_id: int, session_id: int, result: dict, frame):
        from models.db import db, DetectionLog
        from services.inference import LATEST_BOXES

        detection_type = result.get("type")
        confidence = result.get("confidence", 0.0)
        boxes = result.get("boxes") or LATEST_BOXES.get(cctv_id, [])
        snapshot_path = self._save_snapshot(frame, cctv_id, detection_type, boxes)

        log = DetectionLog(  # type: ignore[call-arg]
            cctv_id=cctv_id,
            session_id=session_id,
            type=detection_type,
            confidence=confidence,
            snapshot_path=snapshot_path,
        )
        db.session.add(log)
        db.session.commit()

    @staticmethod
    def _save_snapshot(frame, cctv_id: int, detection_type: str, boxes=None) -> str:
        os.makedirs(Config.CAPTURES_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_cctv{cctv_id}_{detection_type}.jpg"
        filepath = os.path.join(Config.CAPTURES_DIR, filename)

        display = frame.copy()
        for (x1, y1, x2, y2, label, conf, color) in (boxes or []):
            cv2.rectangle(display, (x1, y1), (x2, y2), color, 2)
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(display, (x1, y1 - th - 6), (x1 + tw + 6, y1), color, -1)
            cv2.putText(display, label, (x1 + 3, y1 - 3),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

        cv2.imwrite(filepath, display)
        return filepath
