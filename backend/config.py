import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    DEBUG = os.getenv('FLASK_DEBUG', 'False') == 'True'
    SESSION_COOKIE_SAMESITE = 'Lax'

    POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
    POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
    POSTGRES_DB = os.getenv('POSTGRES_DB', 'tunnel_detection')
    POSTGRES_USER = os.getenv('POSTGRES_USER', 'admin')
    POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'password')

    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://{os.getenv('POSTGRES_USER', 'admin')}:"
        f"{os.getenv('POSTGRES_PASSWORD', 'password')}@"
        f"{os.getenv('POSTGRES_HOST', 'localhost')}:"
        f"{os.getenv('POSTGRES_PORT', '5432')}/"
        f"{os.getenv('POSTGRES_DB', 'tunnel_detection')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FASTAPI_URL = os.getenv('FASTAPI_URL', 'http://localhost:8000')

    ITS_API_KEY = os.getenv('ITS_API_KEY', '')
    ITS_API_BASE_URL = os.getenv('ITS_API_BASE_URL', 'https://openapi.its.go.kr:9443')
    ITS_REGION = os.getenv('ITS_REGION', '서울,경기도')
    ITS_REFRESH_INTERVAL = int(os.getenv('ITS_REFRESH_INTERVAL', '120'))

    CORS_ORIGINS = ['http://localhost:3000', 'http://react:3000']
