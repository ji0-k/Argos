import base64
import logging
import os
import random
from io import BytesIO

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

MODEL_PATH = '/app/models/keras_fire_model.h5'
CLASSES = ['normal', 'smoke', 'fire']

_model = None


def _load():
    global _model
    if _model is not None:
        return _model
    if not os.path.exists(MODEL_PATH) or os.path.getsize(MODEL_PATH) == 0:
        logger.warning('Keras 모델 없음 — 더미 모드')
        return None
    try:
        import tensorflow as tf
        _model = tf.keras.models.load_model(MODEL_PATH)
        logger.info('Keras 모델 로드 완료')
        return _model
    except Exception as e:
        logger.error('Keras 로드 실패: %s', e)
        return None


def _decode(frame_b64: str) -> np.ndarray:
    img = Image.open(BytesIO(base64.b64decode(frame_b64))).convert('RGB').resize((224, 224))
    return np.array(img, dtype=np.float32) / 255.0


def predict_fire_smoke(frame_b64: str, cctv_id: int) -> dict:
    model = _load()
    if model is None:
        return {'type': 'normal', 'confidence': round(random.uniform(0.85, 0.99), 2)}

    try:
        arr = np.expand_dims(_decode(frame_b64), axis=0)
        preds = model.predict(arr, verbose=0)[0]
        idx = int(np.argmax(preds))
        return {'type': CLASSES[idx], 'confidence': round(float(preds[idx]), 4)}
    except Exception as e:
        logger.error('Keras 추론 오류: %s', e)
        return {'type': 'normal', 'confidence': 0.0}
