from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class FrameRequest(BaseModel):
    frame: str      # base64 인코딩 이미지
    cctv_id: int


class FireResponse(BaseModel):
    type: str       # fire / smoke / normal
    confidence: float


class VehicleResponse(BaseModel):
    type: str       # stopped_vehicle / congestion / normal
    confidence: float
    bbox: list[int] = []


@router.post("/frame", response_model=FireResponse)
async def infer_frame(req: FrameRequest):
    """화재/연기 탐지 - HuggingFace ViT 모델"""
    from main import fire_detector
    if fire_detector is None:
        raise HTTPException(status_code=503, detail="화재 감지 모델이 로드되지 않았습니다.")
    try:
        result = fire_detector.predict(req.frame)
        return FireResponse(**result)
    except Exception as e:
        logger.error(f"화재 추론 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vehicle", response_model=VehicleResponse)
async def infer_vehicle(req: FrameRequest):
    """차량 탐지 - YOLOv5 모델"""
    from main import vehicle_detector
    if vehicle_detector is None:
        raise HTTPException(status_code=503, detail="차량 감지 모델이 로드되지 않았습니다.")
    try:
        result = vehicle_detector.predict(req.frame)
        return VehicleResponse(**result)
    except Exception as e:
        logger.error(f"차량 추론 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))
