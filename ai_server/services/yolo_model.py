"""
차량 탐지 서비스

오픈소스 모델: Ultralytics YOLOv5s (COCO pretrained)
- torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
- 최초 실행 시 자동 다운로드 (~28MB)
- COCO 탐지 클래스 중 차량: car(2), motorcycle(3), bus(5), truck(7)

탐지 로직:
- 차량 5대 이상 → congestion (차량정체)
- 차량 1~4대 + 연속 프레임 위치 고정 → stopped_vehicle (정차차량)
"""

import base64
import io
import logging
import time
from collections import deque

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# COCO 데이터셋 차량 클래스 ID
VEHICLE_CLASS_IDS = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# 정체 판정 차량 수 기준
CONGESTION_THRESHOLD = 5

# 정차 판정: 최근 N프레임 동안 bbox 이동 거리 기준 (픽셀)
STOP_FRAME_COUNT = 6
STOP_MOVEMENT_THRESHOLD = 15.0


class VehicleDetector:
    """
    YOLOv5s 기반 차량 탐지 및 정차/정체 분류기.
    모델: ultralytics/yolov5 (torch.hub)
    """

    def __init__(self):
        self.model = None
        self.is_ready = False
        # 차량별 위치 이력 {track_key: deque(maxlen=N)}
        self._position_history: deque = deque(maxlen=STOP_FRAME_COUNT)
        self._load_model()

    def _load_model(self):
        """YOLOv5s 모델을 torch.hub에서 로드 (자동 다운로드)"""
        try:
            import torch
            logger.info("YOLOv5s 모델 로드 중 (torch.hub)...")
            self.model = torch.hub.load(
                "ultralytics/yolov5",
                "yolov5s",
                pretrained=True,
                verbose=False,
                trust_repo=True,
            )
            self.model.conf = 0.40        # 신뢰도 임계값
            self.model.iou = 0.45         # NMS IoU 임계값
            self.model.classes = list(VEHICLE_CLASS_IDS.keys())  # 차량 클래스만
            self.is_ready = True
            logger.info("✅ YOLOv5s 모델 로드 완료")
        except Exception as e:
            logger.warning(f"⚠️ YOLOv5 로드 실패: {e}")
            logger.warning("차량 탐지 폴백 모드로 동작합니다.")
            self.model = None
            self.is_ready = True

    def predict(self, frame_b64: str) -> dict:
        """
        base64 이미지로 차량 상태를 예측합니다.

        Returns:
            {"type": "stopped_vehicle|congestion|normal", "confidence": float, "bbox": [x1,y1,x2,y2]}
        """
        try:
            img = self._decode_image(frame_b64)
        except Exception as e:
            logger.error(f"이미지 디코딩 실패: {e}")
            return {"type": "normal", "confidence": 0.5, "bbox": []}

        if self.model:
            return self._predict_with_yolo(img)
        else:
            return {"type": "normal", "confidence": 0.5, "bbox": []}

    def _predict_with_yolo(self, img: Image.Image) -> dict:
        """YOLOv5 추론 후 정차/정체 판정"""
        try:
            results = self.model(img)
            detections = results.pandas().xyxy[0]

            # 차량 클래스만 필터
            vehicles = detections[detections["class"].isin(VEHICLE_CLASS_IDS.keys())]
            vehicle_count = len(vehicles)

            if vehicle_count == 0:
                self._position_history.clear()
                return {"type": "normal", "confidence": 0.92, "bbox": []}

            # 현재 프레임 차량 중심점 목록
            current_centers = []
            for _, row in vehicles.iterrows():
                cx = (row["xmin"] + row["xmax"]) / 2
                cy = (row["ymin"] + row["ymax"]) / 2
                current_centers.append((cx, cy))
            self._position_history.append(current_centers)

            # 가장 신뢰도 높은 차량의 bbox
            top_vehicle = vehicles.iloc[0]
            bbox = [
                int(top_vehicle["xmin"]), int(top_vehicle["ymin"]),
                int(top_vehicle["xmax"]), int(top_vehicle["ymax"]),
            ]
            top_conf = float(top_vehicle["confidence"])

            # 정체 판정: 차량 수 기준
            if vehicle_count >= CONGESTION_THRESHOLD:
                confidence = min(0.60 + vehicle_count * 0.04, 0.96)
                return {"type": "congestion", "confidence": round(confidence, 4), "bbox": bbox}

            # 정차 판정: 연속 프레임에서 위치 고정
            if len(self._position_history) >= STOP_FRAME_COUNT:
                if self._is_vehicle_stopped():
                    return {
                        "type": "stopped_vehicle",
                        "confidence": round(min(top_conf + 0.1, 0.95), 4),
                        "bbox": bbox,
                    }

            return {"type": "normal", "confidence": round(top_conf, 4), "bbox": bbox}

        except Exception as e:
            logger.error(f"YOLOv5 추론 오류: {e}")
            return {"type": "normal", "confidence": 0.5, "bbox": []}

    def _is_vehicle_stopped(self) -> bool:
        """최근 N프레임 동안 주요 차량의 이동 거리가 임계값 미만인지 확인"""
        frames = list(self._position_history)
        if len(frames) < 2:
            return False

        # 첫 프레임과 마지막 프레임의 가장 가까운 차량 매칭
        first_centers = frames[0]
        last_centers = frames[-1]

        if not first_centers or not last_centers:
            return False

        # 가장 가까운 쌍의 최소 이동 거리
        min_movement = float("inf")
        for fc in first_centers:
            for lc in last_centers:
                dist = ((fc[0] - lc[0]) ** 2 + (fc[1] - lc[1]) ** 2) ** 0.5
                min_movement = min(min_movement, dist)

        return min_movement < STOP_MOVEMENT_THRESHOLD

    @staticmethod
    def _decode_image(b64_str: str) -> Image.Image:
        img_bytes = base64.b64decode(b64_str)
        return Image.open(io.BytesIO(img_bytes)).convert("RGB")
