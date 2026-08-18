import os


class Config:
    """Application configuration."""

    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    DEBUG = True
    TESTING = False

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///teledrive.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Upload limits
    # Note: VHDX/VMDK files can be very large. Default is 10 GB (10737418240 bytes).
    MAX_UPLOAD_SIZE = int(os.environ.get("MAX_UPLOAD_SIZE", 10737418240))  # default 10 GB
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_UPLOAD_SIZE", 10737418240))  # same as upload limit

    # Telegram
    TG_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    TG_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

    # Frontend
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Rate limiting
    RATELIMIT_DEFAULT = "200 per day;50 per hour;10 per minute"
    RATELIMIT_STORAGE_URI = "memory://"

    # Session
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
    PERMANENT_SESSION_LIFETIME = 3600  # 1 hour