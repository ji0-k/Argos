from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class CctvList(db.Model):
    __tablename__ = "cctv_list"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    region = db.Column(db.String(50), nullable=False)
    stream_url = db.Column(db.Text, nullable=False)
    its_id = db.Column(db.String(100), unique=True, nullable=False)
    status = db.Column(db.String(20), default="active")
    coord_lat = db.Column(db.Float, nullable=True)   # 위도 (정렬용)
    coord_lng = db.Column(db.Float, nullable=True)   # 경도
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "region": self.region,
            "stream_url": self.stream_url,
            "its_id": self.its_id,
            "status": self.status,
            "coord_lat": self.coord_lat,
            "coord_lng": self.coord_lng,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class DetectionSession(db.Model):
    __tablename__ = "detection_session"

    id = db.Column(db.Integer, primary_key=True)
    cctv_id = db.Column(db.Integer, db.ForeignKey("cctv_list.id"), nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "cctv_id": self.cctv_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }


class DetectionLog(db.Model):
    __tablename__ = "detection_log"

    id = db.Column(db.Integer, primary_key=True)
    cctv_id = db.Column(db.Integer, db.ForeignKey("cctv_list.id"), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey("detection_session.id"), nullable=True)
    type = db.Column(db.String(50), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    snapshot_path = db.Column(db.Text, nullable=True)
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)

    cctv = db.relationship("CctvList", backref="logs")

    def to_dict(self):
        return {
            "id": self.id,
            "cctv_id": self.cctv_id,
            "cctv_name": self.cctv.name if self.cctv else None,
            "session_id": self.session_id,
            "type": self.type,
            "confidence": self.confidence,
            "snapshot_path": self.snapshot_path,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
        }


class AdminUser(db.Model):
    __tablename__ = "admin_user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
