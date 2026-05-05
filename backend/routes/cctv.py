import threading
from datetime import datetime
from flask import Blueprint, jsonify, Response, request, current_app
from models.db import db, CctvList, DetectionSession
from services.stream import generate_mjpeg
from services.detection import start_detection, stop_detection
from sockets.events import socketio

cctv_bp = Blueprint('cctv', __name__)


@cctv_bp.route('/api/cctv/list')
def list_cctv():
    region = request.args.get('region')
    q = CctvList.query
    if region:
        q = q.filter_by(region=region)
    return jsonify([c.to_dict() for c in q.all()])


@cctv_bp.route('/api/cctv/<int:cctv_id>')
def get_cctv(cctv_id):
    cctv = CctvList.query.get_or_404(cctv_id)
    return jsonify(cctv.to_dict())


@cctv_bp.route('/api/cctv/<int:cctv_id>/stream')
def stream(cctv_id):
    cctv = CctvList.query.get_or_404(cctv_id)
    return Response(
        generate_mjpeg(cctv_id, cctv.stream_url),
        mimetype='multipart/x-mixed-replace; boundary=frame',
    )


@cctv_bp.route('/api/cctv/<int:cctv_id>/detection/start', methods=['POST'])
def detection_start(cctv_id):
    cctv = CctvList.query.get_or_404(cctv_id)
    sess = DetectionSession(cctv_id=cctv_id)
    db.session.add(sess)
    db.session.commit()

    app = current_app._get_current_object()
    threading.Thread(
        target=start_detection,
        args=(cctv_id, sess.id, cctv.stream_url, socketio, app),
        daemon=True,
    ).start()

    return jsonify({'session_id': sess.id})


@cctv_bp.route('/api/cctv/<int:cctv_id>/detection/stop', methods=['POST'])
def detection_stop(cctv_id):
    data = request.get_json() or {}
    session_id = data.get('session_id')

    stop_detection(cctv_id)

    if session_id:
        sess = DetectionSession.query.get(session_id)
        if sess:
            sess.ended_at = datetime.utcnow()
            db.session.commit()

    return jsonify({'success': True})
