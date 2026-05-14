import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

_vehicle_models = {}   # cctv_id → 전용 YOLO 인스턴스
_fire_model = None

VEHICLE_COCO_IDS  = {2, 3, 5, 7}  # car, motorcycle, bus, truck
STOPPED_PX        = 80             # 이 픽셀 이하 이동이면 정지로 간주
CONGESTION_FRAMES = 2              # ≈3초 (2프레임 × 2s)
CONGESTION_COUNT  = 3              # 정지 차량 3대 이상 → 정체
STOPPED_FRAMES    = 5              # 10초 (5프레임 × 2s) → 정차
TRACK_HISTORY     = {}             # cctv_id → {track_id: deque of (cx,cy,x1,y1,x2,y2,conf)}

# cctv_id → [(x1,y1,x2,y2, label, conf, bgr_color), ...]
LATEST_BOXES: dict = {}


def _load_vehicle_model(cctv_id: int = 0):
    if cctv_id not in _vehicle_models:
        from ultralytics import YOLO
        logger.info(f"YOLO 차량 모델 로딩 (cctv_id={cctv_id})...")
        _vehicle_models[cctv_id] = YOLO("yolov8n.pt")
    return _vehicle_models[cctv_id]


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
    """화재/연기 감지 — YOLO 모델 우선, 없으면 HSV 색상 분석"""
    model = _load_fire_model()
    if model:
        try:
            results = model(frame_bgr, verbose=False)[0]
            boxes = results.boxes
            if boxes is not None and len(boxes) > 0:
                fire_boxes = []
                best_conf = 0.0
                for i in range(len(boxes)):
                    conf = float(boxes.conf[i])
                    cls = int(boxes.cls[i])
                    cls_name = (model.names.get(cls) or "fire").lower()
                    if "smoke" in cls_name:
                        continue  # 연기 감지 비활성화
                    x1, y1, x2, y2 = [int(v) for v in boxes.xyxy[i].tolist()]
                    fire_boxes.append((x1, y1, x2, y2, f"Fire {conf:.0%}", conf, (0, 30, 220)))
                    best_conf = max(best_conf, conf)
                if fire_boxes:
                    return {"type": "fire", "confidence": round(best_conf, 3), "boxes": fire_boxes}
            return {"type": "normal", "confidence": 0.0}
        except Exception as e:
            logger.error(f"화재 추론 오류: {e}")
            return {"type": "normal", "confidence": 0.0}

    return _infer_fire_hsv(frame_bgr)


def _infer_fire_hsv(frame_bgr: np.ndarray) -> dict:
    """HSV 색상 분석 기반 화재/연기 감지 (모델 없을 때 fallback)"""
    import cv2

    h, w = frame_bgr.shape[:2]
    total = h * w

    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)

    # 화재: 붉은~주황 계열, 고채도, 고명도
    fire_mask = (
        cv2.inRange(hsv, np.array([0,  150, 150]), np.array([35, 255, 255])) |
        cv2.inRange(hsv, np.array([160, 150, 150]), np.array([180, 255, 255]))
    )
    fire_ratio = cv2.countNonZero(fire_mask) / total

    if fire_ratio > 0.04:
        conf = round(min(fire_ratio * 15, 0.95), 3)
        return {"type": "fire", "confidence": conf}

    return {"type": "normal", "confidence": 0.0}


def infer_vehicle(frame_bgr: np.ndarray, cctv_id: int = 0) -> dict:
    """차량 감지 — ByteTrack 기반 정체/정차 판단"""
    from collections import deque

    try:
        model = _load_vehicle_model(cctv_id)
        results = model.track(frame_bgr, persist=True, verbose=False, tracker="bytetrack.yaml")[0]
        boxes = results.boxes

        # 트래킹 결과 파싱
        tracks = []
        if boxes is not None and boxes.id is not None:
            for tid, cls, conf, xyxy in zip(boxes.id, boxes.cls, boxes.conf, boxes.xyxy):
                if int(cls) in VEHICLE_COCO_IDS:
                    x1, y1, x2, y2 = xyxy.tolist()
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                    tracks.append((int(tid), cx, cy, int(x1), int(y1), int(x2), int(y2), float(conf)))

        hist = TRACK_HISTORY.setdefault(cctv_id, {})

        # 사라진 트랙 제거
        active_ids = {t[0] for t in tracks}
        for tid in list(hist.keys()):
            if tid not in active_ids:
                del hist[tid]

        # 트랙 히스토리 업데이트
        maxlen = max(STOPPED_FRAMES, CONGESTION_FRAMES)
        for tid, cx, cy, x1, y1, x2, y2, conf in tracks:
            hist.setdefault(tid, deque(maxlen=maxlen)).append((cx, cy, x1, y1, x2, y2, conf))

        if not tracks:
            LATEST_BOXES.pop(cctv_id, None)
            return {"type": "normal", "confidence": 0.0}

        def is_stopped(dq, n):
            if len(dq) < n:
                return False
            pts = list(dq)[-n:]
            cx0, cy0 = pts[0][0], pts[0][1]
            return all(((p[0]-cx0)**2 + (p[1]-cy0)**2)**0.5 <= STOPPED_PX for p in pts[1:])

        # 정체: 3초 이상(CONGESTION_FRAMES) 정지 차량이 CONGESTION_COUNT대 이상
        congested_tids = [tid for tid, dq in hist.items() if is_stopped(dq, CONGESTION_FRAMES)]
        if len(congested_tids) >= CONGESTION_COUNT:
            conf = sum(t[7] for t in tracks) / len(tracks)
            LATEST_BOXES[cctv_id] = [
                (t[3], t[4], t[5], t[6], f"Congestion {t[7]:.0%}", t[7], (0, 50, 220))
                for t in tracks
            ]
            return {"type": "congestion", "confidence": round(conf, 3)}

        # 정차: 10초 이상(STOPPED_FRAMES) 정지 차량 존재
        for tid, dq in hist.items():
            if is_stopped(dq, STOPPED_FRAMES):
                t = next((x for x in tracks if x[0] == tid), None)
                if t:
                    LATEST_BOXES[cctv_id] = [
                        (t[3], t[4], t[5], t[6], f"Stopped {t[7]:.0%}", t[7], (0, 165, 255))
                    ]
                    return {"type": "stopped_vehicle", "confidence": round(t[7], 3)}

        # 정상: 모든 차량에 초록 박스
        LATEST_BOXES[cctv_id] = [
            (t[3], t[4], t[5], t[6], f"#{t[0]}", t[7], (0, 180, 60))
            for t in tracks
        ]
        return {"type": "normal", "confidence": 0.0}

    except Exception as e:
        logger.error(f"차량 추론 오류: {e}")
        return {"type": "normal", "confidence": 0.0}
