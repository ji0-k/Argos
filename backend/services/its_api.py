import logging
import requests
from config import Config

logger = logging.getLogger(__name__)

REGION_CODES = {'서울': '11', '경기도': '41'}


def fetch_cctv_list(region: str) -> list:
    try:
        params = {
            'apiKey': Config.ITS_API_KEY,
            'type': 'json',
            'pageNo': 1,
            'numOfRows': 100,
            'getType': 'tunnel',
            'sidoCode': REGION_CODES.get(region, ''),
        }
        url = f"{Config.ITS_API_BASE_URL}/openapi/its/getCCTVInfo"
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()

        items = resp.json().get('response', {}).get('body', {}).get('items', [])
        return [
            {
                'its_id': item.get('cctvId', ''),
                'name': item.get('cctvName', ''),
                'location': item.get('cctvAddr', ''),
                'region': region,
                'stream_url': item.get('cctvUrl', ''),
            }
            for item in items
        ]
    except Exception as e:
        logger.error('ITS API 호출 실패 (%s): %s', region, e)
        return []


def fetch_all_regions() -> list:
    result = []
    for region in Config.ITS_REGION.split(','):
        result.extend(fetch_cctv_list(region.strip()))
    return result
