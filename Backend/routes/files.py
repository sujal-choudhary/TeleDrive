"""
File API routes.

GET    /api/files
POST   /api/files/upload
GET    /api/files/<id>
GET    /api/files/<id>/download
PATCH  /api/files/<id>
DELETE /api/files/<id>
"""

import logging

from flask import Blueprint, request, jsonify, Response, stream_with_context, current_app
from werkzeug.exceptions import RequestEntityTooLarge

from extensions import db, limiter
from models import File
from services.file_service import FileService
from services.telegram_storage import (
    TelegramStorageError,
    TelegramUploadError,
    TelegramDownloadError,
    TelegramDeleteError,
    TelegramFileNotFoundError,
)
from utils.errors import success_response, error_response
from utils.validators import ValidationError

logger = logging.getLogger(__name__)

files_bp = Blueprint("files", __name__)


def get_file_service():
    """Get the file service from the app context."""
    return FileService(
        telegram_service=current_app.telegram_service,
        max_upload_size=current_app.config["MAX_UPLOAD_SIZE"],
    )


@files_bp.route("/api/files", methods=["GET"])
@limiter.limit("120 per minute")
def list_files():
    """List files with optional filters and sorting."""
    try:
        # Parse query parameters
        folder_id = request.args.get("folder")
        search = request.args.get("search")
        starred = request.args.get("starred")
        trashed = request.args.get("trash")
        file_type = request.args.get("type")
        sort_by = request.args.get("sort_by", "name")
        sort_order = request.args.get("sort_order", "asc")

        # Validate sort parameters
        allowed_sort_fields = {"name", "size", "created_at", "updated_at", "type"}
        if sort_by not in allowed_sort_fields:
            return error_response(
                f"Invalid sort_by. Must be one of: {', '.join(sorted(allowed_sort_fields))}",
                "INVALID_SORT",
                400,
            )

        if sort_order not in {"asc", "desc"}:
            return error_response("Invalid sort_order. Must be 'asc' or 'desc'", "INVALID_SORT", 400)

        # Parse boolean filters
        starred_bool = None
        if starred is not None:
            starred_bool = starred.lower() in {"true", "1", "yes"}

        trashed_bool = None
        if trashed is not None:
            trashed_bool = trashed.lower() in {"true", "1", "yes"}

        # Parse folder_id
        folder_id_int = None
        if folder_id is not None and folder_id != "":
            try:
                folder_id_int = int(folder_id)
            except ValueError:
                return error_response("Invalid folder ID", "INVALID_FOLDER_ID", 400)

        service = get_file_service()

        files = service.list_files(
            folder_id=folder_id_int,
            search=search,
            starred=starred_bool,
            trashed=trashed_bool,
            file_type=file_type,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        return success_response(
            data={"files": [f.to_dict() for f in files]},
            message="Files retrieved successfully",
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 400)
    except Exception as e:
        logger.exception("Error listing files")
        return error_response("Failed to list files", "INTERNAL_ERROR", 500)


@files_bp.route("/api/files/upload", methods=["POST"])
@limiter.limit("30 per minute")
def upload_files():
    """Upload one or more files to Telegram and store metadata."""
    try:
        if "file" not in request.files:
            return error_response("No file provided. Use field name 'file'.", "NO_FILE", 400)

        files = request.files.getlist("file")

        if not files or all(f.filename == "" for f in files):
            return error_response("No file provided", "NO_FILE", 400)

        # Parse folder_id
        folder_id = request.form.get("folder_id")
        folder_id_int = None

        if folder_id:
            try:
                folder_id_int = int(folder_id)
            except ValueError:
                return error_response("Invalid folder ID", "INVALID_FOLDER_ID", 400)

        # Parse relative paths for folder uploads (one per file)
        paths = request.form.getlist("paths")
        if paths and len(paths) != len(files):
            paths = None

        service = get_file_service()

        uploaded = service.upload_files(files, folder_id=folder_id_int, paths=paths)

        return success_response(
            data={"files": [f.to_dict() for f in uploaded]},
            message=f"Uploaded {len(uploaded)} file(s) successfully",
            status_code=201,
        )

    except RequestEntityTooLarge:
        return error_response("Upload exceeds maximum allowed size", "FILE_TOO_LARGE", 413)
    except ValidationError as e:
        return error_response(e.message, e.code, 400)
    except TelegramUploadError as e:
        logger.error("Telegram upload failed: %s", e.message)
        return error_response(e.message, "TELEGRAM_UPLOAD_ERROR", e.status_code)
    except TelegramStorageError as e:
        logger.error("Telegram storage error: %s", e.message)
        return error_response(e.message, "TELEGRAM_ERROR", e.status_code)
    except Exception as e:
        logger.exception("Error uploading files")
        return error_response("Failed to upload files", "INTERNAL_ERROR", 500)


@files_bp.route("/api/files/<int:file_id>", methods=["GET"])
@limiter.limit("120 per minute")
def get_file(file_id):
    """Get a single file's metadata."""
    try:
        service = get_file_service()
        file = service.get_file(file_id)

        return success_response(
            data={"file": file.to_dict(include_folder=True)},
            message="File retrieved successfully",
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 404)
    except Exception as e:
        logger.exception("Error getting file %s", file_id)
        return error_response("Failed to get file", "INTERNAL_ERROR", 500)


@files_bp.route("/api/files/<int:file_id>/content", methods=["GET"])
@limiter.limit("120 per minute")
def get_file_content(file_id):
    """Get file content as text for the text editor (text/code files only)."""
    try:
        service = get_file_service()
        telegram_response, file = service.download_file(file_id)

        # Only allow text-based files
        mime = (file.mime_type or "").lower()
        ext = (file.extension or "").lower()
        text_mimes = [
            "text/",
            "application/json",
            "application/javascript",
            "application/xml",
            "application/x-python",
            "application/x-java-source",
            "application/x-sh",
            "application/x-yaml",
            "application/x-httpd-php",
        ]
        text_exts = {"txt", "md", "log", "csv", "json", "js", "ts", "py", "java", "css", "html", "xml", "c", "cpp", "go", "rs", "sh", "yaml", "yml", "ini", "cfg", "conf", "env", "gitignore", "dockerfile"}

        is_text = any(mime.startswith(t) for t in text_mimes) or ext in text_exts
        if not is_text:
            telegram_response.close()
            return error_response("File is not a text file", "NOT_TEXT_FILE", 400)

        # Read content (limit to 5MB for text files)
        content = b""
        for chunk in telegram_response.iter_content(chunk_size=64 * 1024):
            if chunk:
                content += chunk
                if len(content) > 5 * 1024 * 1024:
                    telegram_response.close()
                    return error_response("File is too large to edit as text", "FILE_TOO_LARGE", 413)
        telegram_response.close()

        # Try to decode as UTF-8, fallback to latin-1
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")

        return success_response(
            data={"content": text, "file": file.to_dict()},
            message="File content retrieved successfully",
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 404)
    except TelegramFileNotFoundError as e:
        return error_response(e.message, "FILE_NOT_FOUND", 404)
    except TelegramDownloadError as e:
        logger.error("Content fetch failed for file %s: %s", file_id, e.message)
        return error_response(e.message, "DOWNLOAD_ERROR", e.status_code)
    except TelegramStorageError as e:
        logger.error("Telegram storage error: %s", e.message)
        return error_response(e.message, "TELEGRAM_ERROR", e.status_code)
    except Exception as e:
        logger.exception("Error getting content for file %s", file_id)
        return error_response("Failed to get file content", "INTERNAL_ERROR", 500)


@files_bp.route("/api/files/<int:file_id>/content", methods=["PUT"])
@limiter.limit("60 per minute")
def save_file_content(file_id):
    """Save text content back to a file."""
    try:
        data = request.get_json(silent=True) or {}
        content = data.get("content")
        if content is None:
            return error_response("No content provided", "NO_CONTENT", 400)

        service = get_file_service()
        file = service.get_file(file_id)

        # Only allow text-based files
        mime = (file.mime_type or "").lower()
        ext = (file.extension or "").lower()
        text_mimes = [
            "text/",
            "application/json",
            "application/javascript",
            "application/xml",
            "application/x-python",
            "application/x-java-source",
            "application/x-sh",
            "application/x-yaml",
            "application/x-httpd-php",
        ]
        text_exts = {"txt", "md", "log", "csv", "json", "js", "ts", "py", "java", "css", "html", "xml", "c", "cpp", "go", "rs", "sh", "yaml", "yml", "ini", "cfg", "conf", "env", "gitignore", "dockerfile"}

        is_text = any(mime.startswith(t) for t in text_mimes) or ext in text_exts
        if not is_text:
            return error_response("File is not a text file", "NOT_TEXT_FILE", 400)

        # Encode content to bytes
        content_bytes = content.encode("utf-8")

        # Save to temporary file and upload to Telegram
        import tempfile
        import os
        from werkzeug.utils import secure_filename

        temp_dir = tempfile.gettempdir()
        temp_name = secure_filename(f"teledrive_edit_{file.name}")
        temp_path = os.path.join(temp_dir, f"{temp_name}_{os.getpid()}_{id(file)}")

        try:
            with open(temp_path, "wb") as f:
                f.write(content_bytes)

            # Upload new version to Telegram
            telegram_info = service.telegram.upload_file(temp_path, file.name)

            # Update file metadata
            file.telegram_file_id = telegram_info["telegram_file_id"]
            file.telegram_file_unique_id = telegram_info["telegram_file_unique_id"]
            file.telegram_message_id = telegram_info["telegram_message_id"]
            file.file_size = telegram_info["file_size"]
            db.session.commit()

            return success_response(
                data={"file": file.to_dict()},
                message="File content saved successfully",
            )
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    logger.warning("Could not remove temp file: %s", temp_path)

    except ValidationError as e:
        return error_response(e.message, e.code, 404)
    except TelegramUploadError as e:
        logger.error("Telegram upload failed: %s", e.message)
        return error_response(e.message, "TELEGRAM_UPLOAD_ERROR", e.status_code)
    except TelegramStorageError as e:
        logger.error("Telegram storage error: %s", e.message)
        return error_response(e.message, "TELEGRAM_ERROR", e.status_code)
    except Exception as e:
        logger.exception("Error saving content for file %s", file_id)
        return error_response("Failed to save file content", "INTERNAL_ERROR", 500)


@files_bp.route("/api/files/<int:file_id>/download", methods=["GET"])
@limiter.limit("60 per minute")
def download_file(file_id):
    """Stream a file from Telegram to the browser."""
    try:
        service = get_file_service()
        telegram_response, file = service.download_file(file_id)

        # Build response headers
        headers = {
            "Content-Disposition": f'attachment; filename="{file.name}"',
            "Content-Type": file.mime_type or "application/octet-stream",
            "Content-Length": str(file.file_size),
            "X-Content-Type-Options": "nosniff",
        }

        def generate():
            try:
                for chunk in telegram_response.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        yield chunk
            finally:
                telegram_response.close()

        return Response(
            stream_with_context(generate()),
            headers=headers,
            status=200,
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 404)
    except TelegramFileNotFoundError as e:
        return error_response(e.message, "FILE_NOT_FOUND", 404)
    except TelegramDownloadError as e:
        logger.error("Download failed for file %s: %s", file_id, e.message)
        return error_response(e.message, "DOWNLOAD_ERROR", e.status_code)
    except TelegramStorageError as e:
        logger.error("Telegram storage error: %s", e.message)
        return error_response(e.message, "TELEGRAM_ERROR", e.status_code)
    except Exception as e:
        logger.exception("Error downloading file %s", file_id)
        return error_response("Failed to download file", "INTERNAL_ERROR", 500)


@files_bp.route("/api/files/<int:file_id>", methods=["PATCH"])
@limiter.limit("60 per minute")
def update_file(file_id):
    """Update file metadata: rename, move, star, trash, restore."""
    try:
        data = request.get_json(silent=True) or {}

        if not data:
            return error_response("No update data provided", "NO_DATA", 400)

        service = get_file_service()

        # Rename
        if "name" in data:
            file = service.rename_file(file_id, data["name"])
            return success_response(
                data={"file": file.to_dict()},
                message="File renamed successfully",
            )

        # Move
        if "folder_id" in data:
            folder_id = data["folder_id"]
            if folder_id is not None:
                try:
                    folder_id = int(folder_id)
                except (ValueError, TypeError):
                    return error_response("Invalid folder ID", "INVALID_FOLDER_ID", 400)

            file = service.move_file(file_id, folder_id)
            return success_response(
                data={"file": file.to_dict()},
                message="File moved successfully",
            )

        # Star
        if "is_starred" in data:
            file = service.toggle_star(file_id, data["is_starred"])
            return success_response(
                data={"file": file.to_dict()},
                message="File starred" if data["is_starred"] else "File unstarred",
            )

        # Trash / Restore
        if "is_trashed" in data:
            file = service.trash_file(file_id, data["is_trashed"])
            action = "moved to trash" if data["is_trashed"] else "restored"
            return success_response(
                data={"file": file.to_dict()},
                message=f"File {action} successfully",
            )

        return error_response("No valid update fields provided", "INVALID_UPDATE", 400)

    except ValidationError as e:
        return error_response(e.message, e.code, 400)
    except Exception as e:
        logger.exception("Error updating file %s", file_id)
        return error_response("Failed to update file", "INTERNAL_ERROR", 500)


@files_bp.route("/api/files/<int:file_id>", methods=["DELETE"])
@limiter.limit("60 per minute")
def delete_file(file_id):
    """Permanently delete a file (Telegram message + SQLite record)."""
    try:
        service = get_file_service()
        service.delete_file_permanently(file_id)

        return success_response(
            data={"id": file_id},
            message="File deleted permanently",
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 404)
    except TelegramDeleteError as e:
        logger.error("Telegram delete failed for file %s: %s", file_id, e.message)
        return error_response(
            "Failed to delete file from Telegram. The file was not removed.",
            "TELEGRAM_DELETE_ERROR",
            e.status_code,
        )
    except TelegramStorageError as e:
        logger.error("Telegram storage error: %s", e.message)
        return error_response(e.message, "TELEGRAM_ERROR", e.status_code)
    except Exception as e:
        logger.exception("Error deleting file %s", file_id)
        return error_response("Failed to delete file", "INTERNAL_ERROR", 500)


@files_bp.route("/api/trash/empty", methods=["POST"])
@limiter.limit("10 per minute")
def empty_trash():
    """Permanently delete all files in trash."""
    try:
        service = get_file_service()
        deleted_count = service.empty_trash()

        return success_response(
            data={"deleted_count": deleted_count},
            message=f"Emptied trash: {deleted_count} file(s) deleted",
        )

    except TelegramDeleteError as e:
        logger.error("Telegram delete failed during empty trash: %s", e.message)
        return error_response(
            "Failed to delete some files from Telegram. No files were removed.",
            "TELEGRAM_DELETE_ERROR",
            e.status_code,
        )
    except Exception as e:
        logger.exception("Error emptying trash")
        return error_response("Failed to empty trash", "INTERNAL_ERROR", 500)