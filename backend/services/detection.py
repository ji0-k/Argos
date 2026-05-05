import cv2
import base64
import logging
import os
import time
import threading
from datetime import datetime

import requests
from config import Config

logger = logging.getLogger(__name__)

CAPTURES_DIR = '/app/captures'
CONFIDENCE_THRESHOLD = 0.7
INFERENCE_INTERVAL = 2  # seconds

_active: dict = {}
_lock = threading.Lock()


def _encode(frame) -> str:
    _, buf = cv2.imencode('.jpg', frame)
    return base64.b64encode(buf.tobytes()).decode()


def _save_snapshot(frame, cctv_id: int) -> str:
    os.makedirs(CAPTURES_DIR, exist_ok=True)
    fname = f"cctv{cctv_id}_{datetime.now().strftime('%Y%m%d_%H%M%S%f')}.jpg"
    path = os.path.join(CAPTURES_DIR, fname)
    cv2.imwrite(path, frame)
    return path


def _infer(endpoint: str, frame_b64: str, cctv_id: int) -> dict | None:
    try:
        r = requests.post(
            f"{Config.FASTAPI_URL}/inference/{endpoint}",
            json={'frame': frame_b64, 'cctv_id': cctv_id},
            timeout=5,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.warning('추론 요청 실패 (%s): %s', endpoint, e)
        return None


def _process(app, cctv_id: int, session_id: int, frame, socketio):
    from models.db import db, DetectionLog, CctvList
    from services.alert import send_alert_email

    frame_b64 = _encode(frame)
    results = [
        _infer('frame', frame_b64, cctv_id),
        _infer('vehicle', frame_b64, cctv_id),
    ]

    with app.app_context():
        cctv = CctvList.query.get(cctv_id)
        for result in results:
            if not result:
                continue
            det_type = result.get('type', 'normal')
            confidence = result.get('confidence', 0.0)
            if det_type == 'normal' or confidence < CONFIDENCE_THRESHOLD:
                continue

            snapshot = _save_snapshot(frame, cctv_id)
            log = DetectionLog(
                cctv_id=cctv_id,
                session_id=session_id,
                type=det_type,
                confidence=confidence,
                snapshot_path=snapshot,
            )
            db.session.add(log)
            db.session.commit()

            alert_data = {
                'cctv_id': cctv_id,
                'cctv_name': cctv.name if cctv else str(cctv_id),
                'type': det_type,
                'confidence': confidence,
                'detected_at': datetime.utcnow().isoformat(),
                'snapshot_path': snapshot,
            }
            socketio.emit('alert', alert_data)

            try:
                send_alert_email(alert_data)
                log.alert_sent = True
                db.session.commit()
            except Exception as e:
                logger.error('이메일 발송 실패: %s', e)


def start_detection(cctv_id: int, session_id: int, stream_url: str, socketio, app):
    from services.stream import read_frame

    with _lock:
        _active[cctv_id] = True

    logger.info('감지 시작 CCTV=%d session=%d', cctv_id, session_id)
    try:
        while _active.get(cctv_id):
            frame = read_frame(cctv_id, stream_url)
            if frame is not None:
                _process(app, cctv_id, session_id, frame, socketio)
            time.sleep(INFERENCE_INTERVAL)
    except Exception as e:
        logger.error('감지 루프 오류 CCTV=%d: %s', cctv_id, e)
    finally:
        logger.info('감지 종료 CCTV=%d', cctv_id)


def stop_detection(cctv_id: int):
    with _lock:
        _active[cctv_id] = False
