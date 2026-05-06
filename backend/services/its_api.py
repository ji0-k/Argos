import re
import requests
import logging
from config import Config

logger = logging.getLogger(__name__)

ITS_CCTV_ENDPOINT = "/cctvInfo"

# 경부고속도로 전 구간 bounding box (서울 ~ 부산)
GYEONGBU_BBOX = {
    "minX": "126.8",
    "maxX": "129.2",
    "minY": "35.0",
    "maxY": "37.6",
}


def fetch_gyeongbu_cctv() -> list[dict]:
    if not Config.ITS_API_KEY or Config.ITS_API_KEY == "your_its_api_key_here":
        logger.warning("ITS API 키 미설정 - 샘플 데이터 사용")
        return []

    try:
        params = {
            "apiKey": Config.ITS_API_KEY,
            "type": "json",
            "cctvType": "1",   # 1: 고속도로, 2: 터널
            **GYEONGBU_BBOX,
            "getType": "json",
        }

        url = f"{Config.ITS_API_BASE_URL}{ITS_CCTV_ENDPOINT}"
        response = requests.get(url, params=params, timeout=3)
        response.raise_for_status()
        data = response.json()

        items = data.get("response", {}).get("data", [])
        result = []
        for item in items:
            # API 버전마다 키 대소문자가 다를 수 있어 양쪽 시도
            name = item.get("cctvname") or item.get("cctvName", "")
            if "경부선" not in name:
                continue

            stream_url = (item.get("cctvurl") or item.get("cctvUrl", "")).strip()
            location = (item.get("cctvAddress") or item.get("cctvaddress") or name)

            if not stream_url:
                continue

            # URL에서 숫자 ID 추출: http://cctvsec.ktict.co.kr/72/... → "72"
            m = re.search(r"/(\d+)/", stream_url)
            its_id = m.group(1) if m else stream_url[-10:]

            if not its_id:
                continue

            result.append({
                "its_id": its_id,
                "name": name,
                "location": location,
                "stream_url": stream_url,
                "coord_lat": item.get("coordy"),   # 위도 (경부선: 서울↑ → 부산↓)
                "coord_lng": item.get("coordx"),
            })

        logger.info(f"경부고속도로 CCTV {len(result)}개 수신")
        return result

    except requests.RequestException as e:
        logger.error(f"ITS API 호출 실패: {e}")
        return []
    except Exception as e:
        logger.error(f"ITS API 파싱 오류: {e}")
        return []
