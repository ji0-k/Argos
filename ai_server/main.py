from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routers.inference import router as inference_router
from services.keras_model import FireSmokeDetector
from services.yolo_model import VehicleDetector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 모델 인스턴스 (앱 전체 공유)
fire_detector: FireSmokeDetector = None
vehicle_detector: VehicleDetector = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 모델 로드"""
    global fire_detector, vehicle_detector
    logger.info("AI 모델 로드 시작...")
    fire_detector = FireSmokeDetector()
    vehicle_detector = VehicleDetector()
    logger.info("AI 모델 로드 완료")
    yield
    logger.info("AI 서버 종료")


app = FastAPI(
    title="터널 CCTV AI 추론 서버",
    description="화재/연기 탐지(ViT) + 차량 탐지(YOLOv5) 추론 API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inference_router, prefix="/inference", tags=["inference"])


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "fire_model_loaded": fire_detector is not None and fire_detector.is_ready,
        "vehicle_model_loaded": vehicle_detector is not None and vehicle_detector.is_ready,
    }
