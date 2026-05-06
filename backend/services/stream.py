import cv2
import threading
import logging
import time

logger = logging.getLogger(__name__)


class StreamManager:
    """
    여러 CCTV 스트림을 관리하는 싱글톤 매니저.
    OpenCV로 프레임을 추출하고 MJPEG 형식으로 제공합니다.
    """

    def __init__(self):
        self._captures: dict[int, cv2.VideoCapture] = {}
        self._locks: dict[int, threading.Lock] = {}

    def _get_capture(self, cctv_id: int, stream_url: str) -> cv2.VideoCapture:
        if cctv_id not in self._captures or not self._captures[cctv_id].isOpened():
            cap = cv2.VideoCapture(stream_url)
            if not cap.isOpened():
                logger.warning(f"스트림 열기 실패 (cctv_id={cctv_id}): {stream_url}")
            self._captures[cctv_id] = cap
            self._locks[cctv_id] = threading.Lock()
        return self._captures[cctv_id]

    def get_frames(self, cctv_id: int, stream_url: str):
        """MJPEG 스트리밍용 프레임 제너레이터"""
        cap = self._get_capture(cctv_id, stream_url)
        lock = self._locks.get(cctv_id, threading.Lock())

        while True:
            with lock:
                if not cap.isOpened():
                    # 스트림이 닫힌 경우 재연결 시도
                    cap = self._get_capture(cctv_id, stream_url)
                    time.sleep(1)
                    continue

                ret, frame = cap.read()

            if not ret:
                # 프레임 읽기 실패 시 placeholder 이미지 전송
                placeholder = self._get_placeholder_frame()
                yield placeholder
                time.sleep(0.1)
                continue

            _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            yield jpeg.tobytes()
            time.sleep(0.033)  # ~30fps

    def read_frame(self, cctv_id: int, stream_url: str) -> bytes | None:
        """단일 프레임 읽기 (감지용)"""
        cap = self._get_capture(cctv_id, stream_url)
        lock = self._locks.get(cctv_id, threading.Lock())

        with lock:
            if not cap.isOpened():
                return None
            ret, frame = cap.read()

        if not ret:
            return None

        _, jpeg = cv2.imencode(".jpg", frame)
        return jpeg.tobytes()

    def release(self, cctv_id: int):
        """스트림 해제"""
        if cctv_id in self._captures:
            self._captures[cctv_id].release()
            del self._captures[cctv_id]

    @staticmethod
    def _get_placeholder_frame() -> bytes:
        """스트림 불가 시 표시할 검은 화면"""
        import numpy as np
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(
            frame, "Stream Unavailable", (150, 240),
            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2
        )
        _, jpeg = cv2.imencode(".jpg", frame)
        return jpeg.tobytes()
