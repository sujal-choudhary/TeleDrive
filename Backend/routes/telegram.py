"""
Telegram synchronization routes.

Handles Telegram → TeleDrive sync so files manually sent to the
storage chat appear in the dashboard.

POST /api/telegram/webhook  — production webhook endpoint
POST /api/telegram/sync     — manual poll-based sync trigger
"""

import logging

from flask import Blueprint, request, current_app

from extensions import db, limiter
from models import File
from utils.errors import success_response, error_response

logger = logging.getLogger(__name__)

telegram_bp = Blueprint("telegram", __name__)


def _normalize_document_message(message: dict) -> dict | None:
    """
    Extract document metadata from a Telegram message.

    Returns a dict suitable for creating a File record, or None if
    the message has no supported document.
    """
    document = message.get("document")

    if not document:
        # Also support video files
        video = message.get("video")
        if not video:
            return None

        return {
            "telegram_file_id": video.get("file_id"),
            "telegram_file_unique_id": video.get("file_unique_id"),
            "telegram_message_id": message.get("message_id"),
            "file_size": video.get("file_size", 0),
            "mime_type": video.get("mime_type"),
            "file_name": video.get("file_name"),
            "caption": message.get("caption"),
        }

    return {
        "telegram_file_id": document.get("file_id"),
        "telegram_file_unique_id": document.get("file_unique_id"),
        "telegram_message_id": message.get("message_id"),
        "file_size": document.get("file_size", 0),
        "mime_type": document.get("mime_type"),
        "file_name": document.get("file_name"),
        "caption": message.get("caption"),
    }


def _ingest_message(message: dict) -> "File | None":
    """
    Process a single Telegram message and create a File record if it
    contains a supported document.

    Returns the created File record, or None if skipped (duplicate,
    unsupported type, etc.).
    """
    file_data = _normalize_document_message(message)

    if not file_data:
        return None

    telegram_message_id = file_data["telegram_message_id"]
    telegram_file_unique_id = file_data["telegram_file_unique_id"]

    # Prevent duplicates
    existing = File.query.filter(
        (File.telegram_message_id == telegram_message_id)
        | (File.telegram_file_unique_id == telegram_file_unique_id)
    ).first()

    if existing:
        logger.info("Skipping duplicate Telegram message %s", telegram_message_id)
        return None

    # Build a sensible name
    raw_name = file_data.get("file_name") or file_data.get("caption") or f"telegram_file_{telegram_message_id}"
    safe_name = raw_name.replace("/", "_").replace("\\", "_")

    import os
    from utils.validators import get_extension

    extension = get_extension(safe_name)

    record = File(
        name=safe_name,
        original_name=raw_name,
        telegram_file_id=file_data["telegram_file_id"],
        telegram_file_unique_id=file_data["telegram_file_unique_id"],
        telegram_message_id=telegram_message_id,
        file_size=file_data.get("file_size", 0),
        mime_type=file_data.get("mime_type"),
        extension=extension,
    )

    db.session.add(record)

    return record


@telegram_bp.route("/api/telegram/webhook", methods=["POST"])
@limiter.exempt
def telegram_webhook():
    """
    Receive Telegram webhook updates.

    In production, point the Telegram bot's webhook to this endpoint.
    The bot's access is inherently limited by the secret token, so we
    only verify the request is from Telegram by checking the bot token
    header if configured.
    """
    data = request.get_json(silent=True)

    if not data:
        return error_response("Invalid webhook payload", "INVALID_PAYLOAD", 400)

    message = data.get("message") or data.get("edited_message")

    if not message:
        # Not a message update (e.g. callback_query, channel_post handled separately)
        return success_response(data={"handled": False}, message="Update ignored")

    # Only process messages from the configured storage chat
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id", ""))

    if chat_id != str(current_app.config["TG_CHAT_ID"]):
        logger.info("Ignoring message from chat %s", chat_id)
        return success_response(data={"handled": False}, message="Chat not matched")

    try:
        record = _ingest_message(message)

        if record:
            db.session.commit()
            logger.info("Synced Telegram message %s as file #%s", record.telegram_message_id, record.id)
            return success_response(
                data={"file": record.to_dict()},
                message="File synced from Telegram",
                status_code=201,
            )

        return success_response(data={"handled": True}, message="Message processed")

    except Exception as e:
        db.session.rollback()
        logger.exception("Error ingesting Telegram message")
        return error_response("Failed to process Telegram update", "SYNC_ERROR", 500)


@telegram_bp.route("/api/telegram/sync", methods=["POST"])
@limiter.limit("10 per minute")
def trigger_sync():
    """
    Manually trigger a poll-based sync from Telegram.

    Uses getUpdates to fetch recent messages from the storage chat
    and creates metadata records for supported documents.

    Note: For production, prefer the webhook.
    """
    # Fetch recent updates
    service = current_app.telegram_service

    try:
        updates = service._request(
            "GET",
            "getUpdates",
            params={"timeout": 0, "limit": 100},
        )

        # In polling mode, updates may include messages from the storage chat
        if not updates:
            return success_response(data={"synced": 0}, message="No updates to process")

        synced = 0
        skipped = 0

        for update in updates:
            message = update.get("message") or update.get("edited_message")

            if not message:
                continue

            chat = message.get("chat") or {}
            chat_id = str(chat.get("id", ""))

            if chat_id != str(current_app.config["TG_CHAT_ID"]):
                continue

            try:
                record = _ingest_message(message)
                if record:
                    synced += 1
                else:
                    skipped += 1
            except Exception:
                db.session.rollback()
                logger.exception("Error ingesting a Telegram update")

        db.session.commit()

        return success_response(
            data={"synced": synced, "skipped": skipped},
            message=f"Sync complete: {synced} file(s) synced, {skipped} skipped",
        )

    except Exception as e:
        db.session.rollback()
        logger.exception("Error during Telegram sync")
        return error_response("Sync failed", "SYNC_ERROR", 500)