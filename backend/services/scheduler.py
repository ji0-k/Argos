import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)
_scheduler = BackgroundScheduler()


def _refresh_cctv(app):
    from models.db import db, CctvList
    from services.its_api import fetch_all_regions

    with app.app_context():
        try:
            items = fetch_all_regions()
            if not items:
                logger.warning('ITS API 응답 없음 — DB 갱신 생략')
                return
            for item in items:
                if not item.get('its_id') or not item.get('stream_url'):
                    continue
                existing = CctvList.query.filter_by(its_id=item['its_id']).first()
                if existing:
                    existing.name = item['name']
                    existing.location = item['location']
                    existing.stream_url = item['stream_url']
                    existing.status = 'active'
                else:
                    db.session.add(CctvList(**item))
            db.session.commit()
            logger.info('CCTV 목록 갱신 완료: %d건', len(items))
        except Exception as e:
            db.session.rollback()
            logger.error('CCTV 갱신 실패: %s', e)


def start_scheduler(app):
    from config import Config

    if _scheduler.running:
        return
    _scheduler.add_job(
        func=_refresh_cctv,
        args=[app],
        trigger=IntervalTrigger(seconds=Config.ITS_REFRESH_INTERVAL),
        id='refresh_cctv',
        replace_existing=True,
    )
    _scheduler.start()
    logger.info('스케줄러 시작 (간격: %ds)', Config.ITS_REFRESH_INTERVAL)
