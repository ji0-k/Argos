import eventlet
eventlet.monkey_patch()

import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO

from config import Config
from models.db import db

socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # 확장 초기화
    db.init_app(app)
    CORS(app, origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"])
    JWTManager(app)
    socketio.init_app(app)

    # 라우트 등록
    from routes.cctv import cctv_bp
    from routes.logs import logs_bp
    from routes.admin import admin_bp

    app.register_blueprint(cctv_bp, url_prefix="/api/cctv")
    app.register_blueprint(logs_bp, url_prefix="/api/logs")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    # SocketIO 이벤트 등록
    from sockets import events  # noqa: F401

    return app


app = create_app()

def _auto_start_detection(flask_app):
    from models.db import db, CctvList, DetectionSession
    from routes.cctv import detection_manager, AUTO_DETECT_NAMES
    with flask_app.app_context():
        for name in AUTO_DETECT_NAMES:
            cctv = CctvList.query.filter(CctvList.name.like(f"%{name}%")).first()
            if not cctv:
                continue
            session = DetectionSession(cctv_id=cctv.id)
            db.session.add(session)
            db.session.commit()
            detection_manager.start(cctv.id, session.id, cctv.stream_url, flask_app)


if __name__ == "__main__":
    from services.scheduler import start_scheduler

    with app.app_context():
        db.create_all()
        start_scheduler(app)
        _auto_start_detection(app)

    port = int(os.getenv("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False, use_reloader=False)
