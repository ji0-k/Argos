import os
from dotenv import load_dotenv

load_dotenv()


def _get_db_uri():
    pg = (
        f"postgresql://{os.getenv('POSTGRES_USER','admin')}:{os.getenv('POSTGRES_PASSWORD','password')}"
        f"@{os.getenv('POSTGRES_HOST','localhost')}:{os.getenv('POSTGRES_PORT','5432')}"
        f"/{os.getenv('POSTGRES_DB','tunnel_detection')}"
    )
    try:
        import psycopg2  # noqa: F401
        return pg
    except ImportError:
        return "sqlite:///tunnel_dev.db"


class Config:
    # Flask
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
    DEBUG = os.getenv("FLASK_DEBUG", "False").lower() == "true"

    # PostgreSQL (SQLAlchemy)
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB = os.getenv("POSTGRES_DB", "tunnel_detection")
    POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")

    SQLALCHEMY_DATABASE_URI = _get_db_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # FastAPI AI 서버
    FASTAPI_URL = os.getenv("FASTAPI_URL", "http://localhost:8000")

    # ITS API
    ITS_API_KEY = os.getenv("ITS_API_KEY", "")
    ITS_API_BASE_URL = os.getenv("ITS_API_BASE_URL", "https://openapi.its.go.kr")
    ITS_REGION = os.getenv("ITS_REGION", "서울,경기도").split(",")
    ITS_REFRESH_INTERVAL = int(os.getenv("ITS_REFRESH_INTERVAL", "120"))

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-secret-key")
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1시간

    # 캡처 이미지 저장 경로
    CAPTURES_DIR = os.getenv("CAPTURES_DIR", os.path.join(os.path.dirname(__file__), "captures"))

    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:3001",
                    "http://localhost:3002", "http://localhost:3003", "http://react:3000"]
