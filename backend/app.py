import logging
from flask import Flask
from flask_cors import CORS
from config import Config
from models.db import db
from sockets.events import socketio
from routes.cctv import cctv_bp
from routes.logs import logs_bp
from routes.admin import admin_bp
from services.scheduler import start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(name)s %(levelname)s %(message)s',
)


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)
    db.init_app(app)
    socketio.init_app(app, cors_allowed_origins='*', async_mode='threading')

    app.register_blueprint(cctv_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(admin_bp)

    with app.app_context():
        db.create_all()

    start_scheduler(app)
    return app


app = create_app()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=Config.DEBUG)
