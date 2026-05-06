import cv2
import threading
import logging
import time

logger = logging.getLogger(__name__)

MAX_FAIL = 10  # 연속 실패 N회 이상이면 강제 재연결


class StreamManager:
    def __init__(self):
        self._captures: dict[int, cv2.VideoCapture] = {}
        self._urls: dict[int, str] = {}
        self._locks: dict[int, threading.Lock] = {}

    def _open(self, cctv_id: int, stream_url: str) -> cv2.VideoCapture:
        if cctv_id in self._captures:
            try:
                self._captures[cctv_id].release()
            except Exception:
                pass
        cap = cv2.VideoCapture(stream_url)
        self._captures[cctv_id] = cap
        self._urls[cctv_id] = stream_url
        self._locks.setdefault(cctv_id, threading.Lock())
        if not cap.isOpened():
            logger.warning(f"스트림 열기 실패 (id={cctv_id})")
        return cap

    def get_frames(self, cctv_id: int, stream_url: str):
        cap = self._open(cctv_id, stream_url)
        lock = self._locks[cctv_id]
        fail = 0

        while True:
            with lock:
                ret, frame = cap.read()

            if not ret:
                fail += 1
                if fail >= MAX_FAIL:
                    logger.info(f"스트림 재연결 시도 (id={cctv_id})")
                    with lock:
                        cap = self._open(cctv_id, stream_url)
                    fail = 0
                    time.sleep(2)
                else:
                    yield self._placeholder()
                    time.sleep(0.2)
                continue

            fail = 0

            # 바운딩박스 오버레이
            try:
                from services.inference import LATEST_BOXES
                for x1, y1, x2, y2, label, conf, color in LATEST_BOXES.get(cctv_id, []):
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(frame, label, (x1, max(y1 - 6, 12)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            except Exception:
                pass

            _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            yield jpeg.tobytes()
            time.sleep(0.033)

    def release(self, cctv_id: int):
        if cctv_id in self._captures:
            self._captures[cctv_id].release()
            del self._captures[cctv_id]

    @staticmethod
    def _placeholder() -> bytes:
        import numpy as np
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(frame, "Connecting...", (180, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (100, 100, 100), 2)
        _, jpeg = cv2.imencode(".jpg", frame)
        return jpeg.tobytes()
