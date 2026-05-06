"""
화재/연기 탐지 서비스

오픈소스 모델: EdBianchi/vit-fire-detection (HuggingFace)
- ViT(Vision Transformer) 기반 이미지 분류 모델
- 학습 클래스: Fire / Non-Fire (smoke 포함)
- 자동 다운로드: 최초 실행 시 HuggingFace Hub에서 가중치 다운로드

폴백: 컬러 휴리스틱 (모델 로드 실패 시)
"""

import base64
import io
import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class FireSmokeDetector:
    """
    HuggingFace ViT 화재/연기 탐지 모델 래퍼.
    모델: EdBianchi/vit-fire-detection
    """

    # HuggingFace 모델 ID
    MODEL_ID = "EdBianchi/vit-fire-detection"

    # 모델 라벨 → 시스템 라벨 매핑
    LABEL_MAP = {
        "fire": "fire",
        "non-fire": "normal",
        "smoke": "smoke",
        "normal": "normal",
        "neutral": "normal",
    }

    def __init__(self):
        self.pipeline = None
        self.is_ready = False
        self._load_model()

    def _load_model(self):
        """HuggingFace pipeline 로드"""
        try:
            from transformers import pipeline as hf_pipeline
            logger.info(f"모델 로드 중: {self.MODEL_ID}")
            self.pipeline = hf_pipeline(
                "image-classification",
                model=self.MODEL_ID,
                device=-1,          # CPU (-1), GPU면 0
                top_k=3,
            )
            self.is_ready = True
            logger.info(f"✅ 화재/연기 탐지 모델 로드 완료: {self.MODEL_ID}")
        except Exception as e:
            logger.warning(f"⚠️ HuggingFace 모델 로드 실패: {e}")
            logger.warning("컬러 휴리스틱 폴백 모드로 동작합니다.")
            self.pipeline = None
            self.is_ready = True   # 폴백 모드도 동작 가능

    def predict(self, frame_b64: str) -> dict:
        """
        base64 이미지로 화재/연기 여부를 예측합니다.

        Returns:
            {"type": "fire|smoke|normal", "confidence": 0.0~1.0}
        """
        try:
            img = self._decode_image(frame_b64)
        except Exception as e:
            logger.error(f"이미지 디코딩 실패: {e}")
            return {"type": "normal", "confidence": 0.5}

        if self.pipeline:
            return self._predict_with_model(img)
        else:
            return self._predict_heuristic(img)

    def _predict_with_model(self, img: Image.Image) -> dict:
        """ViT 모델 추론"""
        try:
            results = self.pipeline(img)
            # 결과 예: [{"label": "fire", "score": 0.94}, ...]
            top = results[0]
            raw_label = top["label"].lower().strip()
            mapped_label = self.LABEL_MAP.get(raw_label, "normal")
            confidence = round(float(top["score"]), 4)

            # 두 번째 결과에서 smoke 탐지 (비화재인데 smoke가 높으면)
            if mapped_label == "normal" and len(results) > 1:
                for r in results[1:]:
                    if self.LABEL_MAP.get(r["label"].lower(), "normal") == "smoke":
                        if r["score"] > 0.3:
                            return {"type": "smoke", "confidence": round(float(r["score"]), 4)}

            return {"type": mapped_label, "confidence": confidence}
        except Exception as e:
            logger.error(f"모델 추론 오류: {e}")
            return self._predict_heuristic(img)

    def _predict_heuristic(self, img: Image.Image) -> dict:
        """컬러 기반 폴백 휴리스틱"""
        arr = np.array(img.resize((224, 224))).astype(np.float32)
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

        # 화재: 강한 빨강/주황
        fire_mask = (r > 200) & (g < 160) & (b < 80)
        fire_ratio = float(fire_mask.sum()) / (224 * 224)

        # 연기: 낮은 채도의 회색
        diff_rg = np.abs(r - g)
        diff_rb = np.abs(r - b)
        smoke_mask = (diff_rg < 25) & (diff_rb < 25) & (r > 90) & (r < 210)
        smoke_ratio = float(smoke_mask.sum()) / (224 * 224)

        if fire_ratio > 0.04:
            conf = min(0.55 + fire_ratio * 3, 0.92)
            return {"type": "fire", "confidence": round(conf, 4)}
        elif smoke_ratio > 0.20:
            conf = min(0.50 + smoke_ratio, 0.85)
            return {"type": "smoke", "confidence": round(conf, 4)}
        else:
            return {"type": "normal", "confidence": 0.92}

    @staticmethod
    def _decode_image(b64_str: str) -> Image.Image:
        img_bytes = base64.b64decode(b64_str)
        return Image.open(io.BytesIO(img_bytes)).convert("RGB")
