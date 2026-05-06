import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

_vehicle_model = None
_fire_model = None

VEHICLE_COCO_IDS = {2, 3, 5, 7}   # car, motorcycle, bus, truck
CONGESTION_THRESHOLD = 6            # 차량 6대 이상이면 정체
STOPPED_HISTORY = {}                # cctv_id → deque of centroids
STOPPED_FRAMES = 4                  # N프레임 동안 안 움직이면 정차 판단
STOPPED_MOVE_PX = 20               # 이 픽셀 이하로 움직이면 정차로 간주

# cctv_id → [(x1,y1,x2,y2, label, conf, bgr_color), ...]
LATEST_BOXES: dict = {}


def _load_vehicle_model():
    global _vehicle_model
    if _vehicle_model is None:
        from ultralytics import YOLO
        logger.info("YOLO 차량 모델 로딩 (yolov8n.pt)...")
        _vehicle_model = YOLO("yolov8n.pt")
    return _vehicle_model


def _load_fire_model():
    global _fire_model
    if _fire_model is not None:
        return _fire_model

    from ultralytics import YOLO

    local_path = Path(__file__).parent.parent / "models" / "fire.pt"
    if local_path.exists():
        logger.info(f"로컬 화재 모델 로딩: {local_path}")
        _fire_model = YOLO(str(local_path))
    else:
        try:
            logger.info("화재 감지 모델 다운로드 (keremberke/yolov8n-fire-detection)...")
            _fire_model = YOLO("keremberke/yolov8n-fire-detection")
        except Exception as e:
            logger.warning(f"화재 모델 로딩 실패 — 화재 감지 비활성화: {e}")
            _fire_model = False

    return _fire_model


def infer_fire_smoke(frame_bgr: np.ndarray) -> dict:
    """화재/연기 감지"""
    model = _load_fire_model()
    if not model:
        return {"type": "normal", "confidence": 0.0}

    try:
        results = model(frame_bgr, verbose=False)[0]
        boxes = results.boxes
        if boxes is None or len(boxes) == 0:
            return {"type": "normal", "confidence": 0.0}

        best_idx = int(boxes.conf.argmax())
        best_conf = float(boxes.conf[best_idx])
        best_cls = int(boxes.cls[best_idx])
        cls_name = (model.names.get(best_cls) or "fire").lower()

        det_type = "smoke" if "smoke" in cls_name else "fire"
        return {"type": det_type, "confidence": round(best_conf, 3)}

    except Exception as e:
        logger.error(f"화재 추론 오류: {e}")
        return {"type": "normal", "confidence": 0.0}


def infer_vehicle(frame_bgr: np.ndarray, cctv_id: int = 0) -> dict:
    """차량 감지 — 정체/정차 판단"""
    from collections import deque

    try:
        model = _load_vehicle_model()
        results = model(frame_bgr, verbose=False)[0]
        boxes = results.boxes

        vehicle_data = []
        raw_boxes = []
        if boxes is not None:
            for cls, conf, xyxy in zip(boxes.cls, boxes.conf, boxes.xyxy):
                if int(cls) in VEHICLE_COCO_IDS:
                    x1, y1, x2, y2 = xyxy.tolist()
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                    vehicle_data.append((cx, cy, float(conf)))
                    raw_boxes.append((int(x1), int(y1), int(x2), int(y2), float(conf)))

        n = len(vehicle_data)
        avg_conf = sum(c for _, _, c in vehicle_data) / n if n else 0.0

        # --- 정체 판단 ---
        if n >= CONGESTION_THRESHOLD:
            # 빨간 박스
            LATEST_BOXES[cctv_id] = [
                (x1, y1, x2, y2, f"Congestion {conf:.0%}", conf, (0, 50, 220))
                for x1, y1, x2, y2, conf in raw_boxes
            ]
            return {"type": "congestion", "confidence": round(avg_conf, 3)}

        # --- 정차 판단 (프레임 간 이동 추적) ---
        if n > 0:
            centroids = [(cx, cy) for cx, cy, _ in vehicle_data]
            hist = STOPPED_HISTORY.setdefault(cctv_id, deque(maxlen=STOPPED_FRAMES))
            hist.append(centroids)

            if len(hist) == STOPPED_FRAMES:
                first, last = hist[0], hist[-1]
                for cx0, cy0 in first:
                    for cx1, cy1 in last:
                        dist = ((cx1 - cx0) ** 2 + (cy1 - cy0) ** 2) ** 0.5
                        if dist < STOPPED_MOVE_PX:
                            LATEST_BOXES[cctv_id] = [
                                (x1, y1, x2, y2, f"Stopped {conf:.0%}", conf, (0, 165, 255))
                                for x1, y1, x2, y2, conf in raw_boxes
                            ]
                            stopped_conf = round(avg_conf * (1 - dist / STOPPED_MOVE_PX), 3)
                            return {"type": "stopped_vehicle", "confidence": stopped_conf}

        return {"type": "normal", "confidence": 0.0}

    except Exception as e:
        logger.error(f"차량 추론 오류: {e}")
        return {"type": "normal", "confidence": 0.0}
