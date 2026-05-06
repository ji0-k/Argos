from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt
from models.db import AdminUser

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/login", methods=["POST"])
def login():
    """관리자 로그인"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 본문이 없습니다", "code": 400}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"error": "아이디와 비밀번호를 입력하세요", "code": 400}), 400

    user = AdminUser.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "아이디 또는 비밀번호가 올바르지 않습니다", "code": 401}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user.password.encode("utf-8")):
        return jsonify({"error": "아이디 또는 비밀번호가 올바르지 않습니다", "code": 401}), 401

    token = create_access_token(identity={"id": user.id, "username": user.username})
    return jsonify({"token": token, "success": True, "username": user.username})


@admin_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """로그아웃 (클라이언트에서 토큰 삭제)"""
    return jsonify({"success": True})


@admin_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """현재 로그인 사용자 정보"""
    identity = get_jwt_identity()
    return jsonify({"id": identity["id"], "username": identity["username"]})
