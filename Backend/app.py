"""
TeleDrive Flask application factory.

Sets up:
- SQLite database (metadata only; Telegram stores the actual files)
- Telegram storage service
- CORS restricted to FRONTEND_URL
- Rate limiting
- Security headers
- API blueprints
"""

import logging
import os
from datetime import timedelta

# Load .env BEFORE importing config so env vars are available
from dotenv import load_dotenv

load_dotenv()

from flask import Flask, request, g

from config import Config
from extensions import db, limiter
from models import File, Folder  # noqa: F401 — ensure models are registered
from services.telegram_storage import TelegramStorageService
from routes.files import files_bp
from routes.folders import folders_bp
from routes.telegram import telegram_bp
from utils.errors import register_error_handlers, success_response, error_response

logger = logging.getLogger(__name__)


def create_app(config_class=Config):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    db.init_app(app)

    # Auto-create tables on startup (idempotent — does not drop existing data).
    # This ensures the database is always ready even if init_db.py wasn't run.
    with app.app_context():
        db.create_all()

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------
    limiter.init_app(app)

    # ------------------------------------------------------------------
    # CORS — restricted to the configured frontend origin
    # ------------------------------------------------------------------
    from flask_cors import CORS

    frontend_urls = [url.strip() for url in app.config.get("FRONTEND_URL", "").split(",") if url.strip()]

    if not frontend_urls:
        frontend_urls = ["http://localhost:5173"]

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": frontend_urls,
                "methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
                "supports_credentials": False,
            }
        },
    )

    # ------------------------------------------------------------------
    # Telegram storage service (kept server-side only)
    # ------------------------------------------------------------------
    app.telegram_service = TelegramStorageService(
        bot_token=app.config["TG_BOT_TOKEN"],
        chat_id=app.config["TG_CHAT_ID"],
        timeout=120,
    )

    # ------------------------------------------------------------------
    # Blueprints
    # ------------------------------------------------------------------
    app.register_blueprint(files_bp)
    app.register_blueprint(folders_bp)
    app.register_blueprint(telegram_bp)

    # ------------------------------------------------------------------
    # Error handlers
    # ------------------------------------------------------------------
    register_error_handlers(app)

    # ------------------------------------------------------------------
    # Security headers (after request)
    # ------------------------------------------------------------------
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: blob:; "
            "media-src 'self' blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "connect-src 'self'"
        )
        return response

    # ------------------------------------------------------------------
    # Simple request logging
    # ------------------------------------------------------------------
    @app.before_request
    def log_request():
        if request.path.startswith("/api/"):
            logger.info(
                "%s %s from %s",
                request.method,
                request.path,
                request.remote_addr,
            )

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------
    @app.route("/")
    def home():
        return success_response(
            data={
                "name": "TeleDrive API",
                "version": "1.0.0",
                "storage": "Telegram",
                "metadata_db": "SQLite",
            },
            message="TeleDrive backend is running",
        )

    @app.route("/api/health")
    def health():
        return success_response(
            data={"status": "healthy"},
            message="Service is healthy",
        )

    return app


# Note: No module-level `app` is created here.
# Use `flask run` (Flask CLI auto-detects create_app) or `python app.py`.
if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)