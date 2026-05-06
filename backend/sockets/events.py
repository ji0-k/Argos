from flask_socketio import emit
from app import socketio
import logging

logger = logging.getLogger(__name__)


@socketio.on("connect")
def handle_connect():
    logger.info("관리자 클라이언트 연결")
    emit("connected", {"message": "서버에 연결되었습니다."})


@socketio.on("disconnect")
def handle_disconnect():
    logger.info("관리자 클라이언트 연결 해제")


@socketio.on("ping")
def handle_ping():
    emit("pong", {"status": "ok"})
