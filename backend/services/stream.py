import cv2
import logging
import threading
import numpy as np

logger = logging.getLogger(__name__)

_streams: dict = {}
_lock = threading.Lock()


def _get_cap(cctv_id: int, stream_url: str) -> cv2.VideoCapture:
    with _lock:
        cap = _streams.get(cctv_id)
        if cap and cap.isOpened():
            return cap
        cap = cv2.VideoCapture(stream_url)
        _streams[cctv_id] = cap
        return cap


def _placeholder_frame() -> bytes:
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(img, 'Stream Unavailable', (120, 240),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (100, 100, 100), 2)
    _, buf = cv2.imencode('.jpg', img)
    return buf.tobytes()


def generate_mjpeg(cctv_id: int, stream_url: str):
    cap = _get_cap(cctv_id, stream_url)
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                frame_bytes = _placeholder_frame()
            else:
                _, buf = cv2.imencode('.jpg', frame)
                frame_bytes = buf.tobytes()

            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
            )
    except GeneratorExit:
        pass
    except Exception as e:
        logger.error('스트리밍 오류 CCTV=%d: %s', cctv_id, e)


def read_frame(cctv_id: int, stream_url: str):
    cap = _get_cap(cctv_id, stream_url)
    ret, frame = cap.read()
    return frame if ret else None


def release_stream(cctv_id: int):
    with _lock:
        cap = _streams.pop(cctv_id, None)
        if cap:
            cap.release()
