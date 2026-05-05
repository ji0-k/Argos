from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.keras_model import predict_fire_smoke
from services.yolo_model import predict_vehicle

router = APIRouter(prefix='/inference', tags=['inference'])


class FrameRequest(BaseModel):
    frame: str
    cctv_id: int


@router.post('/frame')
async def infer_frame(req: FrameRequest):
    try:
        return predict_fire_smoke(req.frame, req.cctv_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/vehicle')
async def infer_vehicle(req: FrameRequest):
    try:
        return predict_vehicle(req.frame, req.cctv_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
