from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging
from config import Config

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def refresh_cctv_list(app):
    """ITS API에서 경부고속도로 CCTV 목록을 갱신하고 DB에 upsert합니다."""
    from services.its_api import fetch_gyeongbu_cctv
    from models.db import db, CctvList
    from datetime import datetime

    with app.app_context():
        cctv_items = fetch_gyeongbu_cctv()
        for item in cctv_items:
            existing = CctvList.query.filter_by(its_id=item["its_id"]).first()
            if existing:
                existing.name = item["name"]
                existing.location = item["location"]
                existing.stream_url = item["stream_url"]
                existing.coord_lat = item.get("coord_lat")
                existing.coord_lng = item.get("coord_lng")
                existing.updated_at = datetime.utcnow()
            else:
                db.session.add(CctvList(
                    its_id=item["its_id"],
                    name=item["name"],
                    location=item["location"],
                    region="경부고속도로",
                    stream_url=item["stream_url"],
                    coord_lat=item.get("coord_lat"),
                    coord_lng=item.get("coord_lng"),
                ))
        try:
            db.session.commit()
            logger.info(f"경부고속도로 CCTV 목록 갱신 완료 ({len(cctv_items)}개)")
        except Exception as e:
            db.session.rollback()
            logger.error(f"CCTV 목록 DB 저장 실패: {e}")


def start_scheduler(app):
    if scheduler.running:
        return

    scheduler.add_job(
        func=refresh_cctv_list,
        trigger=IntervalTrigger(seconds=Config.ITS_REFRESH_INTERVAL),
        args=[app],
        id="refresh_cctv",
        name="ITS 경부고속도로 CCTV 갱신",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"스케줄러 시작: {Config.ITS_REFRESH_INTERVAL}초 간격")

    refresh_cctv_list(app)
