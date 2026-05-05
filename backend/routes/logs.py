from flask import Blueprint, jsonify, request
from models.db import DetectionLog

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('/api/logs')
def get_logs():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    log_type = request.args.get('type')

    q = DetectionLog.query
    if log_type:
        q = q.filter_by(type=log_type)
    q = q.order_by(DetectionLog.detected_at.desc())

    total = q.count()
    logs = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({'logs': [l.to_dict() for l in logs], 'total': total})


@logs_bp.route('/api/logs/<int:cctv_id>')
def get_cctv_logs(cctv_id):
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))

    q = DetectionLog.query.filter_by(cctv_id=cctv_id).order_by(
        DetectionLog.detected_at.desc()
    )
    total = q.count()
    logs = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({'logs': [l.to_dict() for l in logs], 'total': total})


@logs_bp.route('/api/logs/stats')
def get_stats():
    from sqlalchemy import func
    from models.db import db

    rows = (
        db.session.query(DetectionLog.type, func.count(DetectionLog.id))
        .group_by(DetectionLog.type)
        .all()
    )
    return jsonify({row[0]: row[1] for row in rows})
