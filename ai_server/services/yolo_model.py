import base64
import logging
import os
import random
from io import BytesIO

from PIL import Image

logger = logging.getLogger(__name__)

MODEL_DIR = '/app/models/yolov5_vehicle'
WEIGHT_PATH = os.path.join(MODEL_DIR, 'best.pt')

_model = None


def _load():
    global _model
    if _model is not None:
        return _model
    if not os.path.exists(WEIGHT_PATH) or os.path.getsize(WEIGHT_PATH) == 0:
        logger.warning('YOLOv5 모델 없음 — 더미 모드')
        return None
    try:
        import torch
        _model = torch.hub.load('ultralytics/yolov5', 'custom', path=WEIGHT_PATH)
        logger.info('YOLOv5 모델 로드 완료')
        return _model
    except Exception as e:
        logger.error('YOLOv5 로드 실패: %s', e)
        return None


def predict_vehicle(frame_b64: str, cctv_id: int) -> dict:
    model = _load()
    if model is None:
        return {'type': 'normal', 'confidence': round(random.uniform(0.85, 0.99), 2), 'bbox': None}

    try:
        img = Image.open(BytesIO(base64.b64decode(frame_b64))).convert('RGB')
        results = model(img)
        dets = results.pandas().xyxy[0]
        if dets.empty:
            return {'type': 'normal', 'confidence': 1.0, 'bbox': None}
        top = dets.iloc[0]
        return {
            'type': top['name'],
            'confidence': round(float(top['confidence']), 4),
            'bbox': [int(top['xmin']), int(top['ymin']), int(top['xmax']), int(top['ymax'])],
        }
    except Exception as e:
        logger.error('YOLOv5 추론 오류: %s', e)
        return {'type': 'normal', 'confidence': 0.0, 'bbox': None}
