import bcrypt
from functools import wraps
from flask import Blueprint, jsonify, request, session
from models.db import AdminUser

admin_bp = Blueprint('admin', __name__)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin_id'):
            return jsonify({'error': '인증이 필요합니다.', 'code': 401}), 401
        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/api/admin/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': '요청 데이터가 없습니다.', 'code': 400}), 400

    username = data.get('username', '')
    password = data.get('password', '')

    user = AdminUser.query.filter_by(username=username).first()
    if not user or not bcrypt.checkpw(password.encode(), user.password.encode()):
        return jsonify({'error': '잘못된 인증 정보입니다.', 'code': 401}), 401

    session['admin_id'] = user.id
    session['admin_username'] = user.username
    return jsonify({'success': True, 'username': user.username})


@admin_bp.route('/api/admin/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@admin_bp.route('/api/admin/me')
@login_required
def me():
    return jsonify({
        'id': session.get('admin_id'),
        'username': session.get('admin_username'),
    })
