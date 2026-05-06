from flask import Blueprint, jsonify, request, Response, current_app
from models.db import db, CctvList, DetectionSession
from services.stream import StreamManager
from services.detection import DetectionManager
import logging

logger = logging.getLogger(__name__)
cctv_bp = Blueprint("cctv", __name__)

stream_manager = StreamManager()
detection_manager = DetectionManager()

# 개발 단계에서 감지를 허용할 CCTV 이름 키워드
AUTO_DETECT_NAMES = ["서초", "[서울]경부동탄터널(부산3)"]

def _detection_allowed(cctv_name: str) -> bool:
    return any(k in cctv_name for k in AUTO_DETECT_NAMES)


@cctv_bp.route("/list", methods=["GET"])
def get_cctv_list():
    """전체 CCTV 목록 반환"""
    region = request.args.get("region")
    query = CctvList.query
    if region:
        query = query.filter_by(region=region)
    # 위도 내림차순 = 서울(북)→부산(남) 진행 방향 순
    cctvs = query.order_by(CctvList.coord_lat.desc().nulls_last(), CctvList.name).all()
    result = []
    for c in cctvs:
        d = c.to_dict()
        d['detecting'] = detection_manager._running.get(c.id, False)
        d['detection_allowed'] = _detection_allowed(c.name)
        result.append(d)
    return jsonify(result)


@cctv_bp.route("/<int:cctv_id>/stream", methods=["GET"])
def stream_cctv(cctv_id):
    """MJPEG 스트리밍"""
    cctv = CctvList.query.get_or_404(cctv_id)

    def generate():
        for frame in stream_manager.get_frames(cctv_id, cctv.stream_url):
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            )

    return Response(
        generate(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@cctv_bp.route("/<int:cctv_id>/detection/start", methods=["POST"])
def start_detection(cctv_id):
    """감지 세션 시작"""
    cctv = CctvList.query.get_or_404(cctv_id)
    if not _detection_allowed(cctv.name):
        return jsonify({"error": "현재 개발 단계에서는 지원하지 않습니다."}), 403

    session = DetectionSession(cctv_id=cctv_id)
    db.session.add(session)
    db.session.commit()

    detection_manager.start(cctv_id, session.id, cctv.stream_url, current_app._get_current_object())
    return jsonify({"session_id": session.id, "success": True})


@cctv_bp.route("/<int:cctv_id>/detection/stop", methods=["POST"])
def stop_detection(cctv_id):
    """감지 세션 종료"""
    data = request.get_json() or {}
    session_id = data.get("session_id")

    detection_manager.stop(cctv_id)

    if session_id:
        from datetime import datetime
        session = DetectionSession.query.get(session_id)
        if session:
            session.ended_at = datetime.utcnow()
            db.session.commit()

    return jsonify({"success": True})
