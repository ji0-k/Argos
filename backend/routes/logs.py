from flask import Blueprint, jsonify, request
from models.db import DetectionLog

logs_bp = Blueprint("logs", __name__)


@logs_bp.route("", methods=["GET"])
def get_all_logs():
    """전체 이상징후 로그 조회 (페이지네이션)"""
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    log_type = request.args.get("type")

    query = DetectionLog.query
    if log_type:
        query = query.filter_by(type=log_type)

    total = query.count()
    logs = (
        query.order_by(DetectionLog.detected_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return jsonify({"logs": [log.to_dict() for log in logs], "total": total, "page": page, "limit": limit})


@logs_bp.route("/<int:cctv_id>", methods=["GET"])
def get_cctv_logs(cctv_id):
    """특정 CCTV 이상징후 로그 조회"""
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))

    query = DetectionLog.query.filter_by(cctv_id=cctv_id)
    total = query.count()
    logs = (
        query.order_by(DetectionLog.detected_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return jsonify({"logs": [log.to_dict() for log in logs], "total": total, "page": page, "limit": limit})


@logs_bp.route("/stats", methods=["GET"])
def get_stats():
    """시간대별 이상징후 통계"""
    from sqlalchemy import func, text
    from models.db import db

    # SQLite 호환: strftime 사용 (PostgreSQL은 date_trunc)
    engine_name = db.engine.dialect.name
    if engine_name == "postgresql":
        hour_expr = func.date_trunc("hour", DetectionLog.detected_at).label("hour")
    else:
        hour_expr = func.strftime("%Y-%m-%dT%H:00:00", DetectionLog.detected_at).label("hour")

    stats = (
        db.session.query(
            hour_expr,
            DetectionLog.type,
            func.count(DetectionLog.id).label("count"),
        )
        .group_by("hour", DetectionLog.type)
        .order_by("hour")
        .limit(168)
        .all()
    )

    result = [
        {"hour": str(s.hour), "type": s.type, "count": s.count}
        for s in stats
    ]
    return jsonify(result)
