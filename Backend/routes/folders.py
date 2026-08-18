"""
Folder API routes.

GET    /api/folders
POST   /api/folders
GET    /api/folders/<id>
PATCH  /api/folders/<id>
DELETE /api/folders/<id>
"""

import logging

from flask import Blueprint, request, current_app

from extensions import limiter
from services.file_service import FileService
from utils.errors import success_response, error_response
from utils.validators import ValidationError

logger = logging.getLogger(__name__)

folders_bp = Blueprint("folders", __name__)


def get_file_service():
    """Get the file service from the app context."""
    return FileService(
        telegram_service=current_app.telegram_service,
        max_upload_size=current_app.config["MAX_UPLOAD_SIZE"],
    )


@folders_bp.route("/api/folders", methods=["GET"])
@limiter.limit("120 per minute")
def list_folders():
    """List folders, optionally filtered by parent."""
    try:
        parent_id = request.args.get("parent")

        parent_id_int = None
        if parent_id is not None and parent_id != "":
            try:
                parent_id_int = int(parent_id)
            except ValueError:
                return error_response("Invalid parent folder ID", "INVALID_FOLDER_ID", 400)

        service = get_file_service()
        folders = service.list_folders(parent_id=parent_id_int)

        return success_response(
            data={"folders": [f.to_dict(include_children=True) for f in folders]},
            message="Folders retrieved successfully",
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 400)
    except Exception as e:
        logger.exception("Error listing folders")
        return error_response("Failed to list folders", "INTERNAL_ERROR", 500)


@folders_bp.route("/api/folders", methods=["POST"])
@limiter.limit("30 per minute")
def create_folder():
    """Create a new folder."""
    try:
        data = request.get_json(silent=True) or {}

        name = data.get("name")
        parent_id = data.get("parent_id")

        if not name:
            return error_response("Folder name is required", "INVALID_FOLDER_NAME", 400)

        parent_id_int = None
        if parent_id is not None:
            try:
                parent_id_int = int(parent_id)
            except (ValueError, TypeError):
                return error_response("Invalid parent folder ID", "INVALID_FOLDER_ID", 400)

        service = get_file_service()
        folder = service.create_folder(name, parent_id=parent_id_int)

        return success_response(
            data={"folder": folder.to_dict()},
            message="Folder created successfully",
            status_code=201,
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 400)
    except Exception as e:
        logger.exception("Error creating folder")
        return error_response("Failed to create folder", "INTERNAL_ERROR", 500)


@folders_bp.route("/api/folders/<int:folder_id>", methods=["GET"])
@limiter.limit("120 per minute")
def get_folder(folder_id):
    """Get a single folder with its contents."""
    try:
        service = get_file_service()
        folder = service.get_folder(folder_id)

        # Get breadcrumbs
        breadcrumbs = service.get_folder_breadcrumbs(folder_id)

        # Get subfolders
        subfolders = service.list_folders(parent_id=folder_id)

        # Get files in this folder
        files = service.list_files(folder_id=folder_id)

        return success_response(
            data={
                "folder": folder.to_dict(),
                "breadcrumbs": breadcrumbs,
                "subfolders": [f.to_dict(include_children=True) for f in subfolders],
                "files": [f.to_dict() for f in files],
            },
            message="Folder retrieved successfully",
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 404)
    except Exception as e:
        logger.exception("Error getting folder %s", folder_id)
        return error_response("Failed to get folder", "INTERNAL_ERROR", 500)


@folders_bp.route("/api/folders/<int:folder_id>", methods=["PATCH"])
@limiter.limit("60 per minute")
def update_folder(folder_id):
    """Update folder: rename or move."""
    try:
        data = request.get_json(silent=True) or {}

        if not data:
            return error_response("No update data provided", "NO_DATA", 400)

        service = get_file_service()

        # Rename
        if "name" in data:
            folder = service.rename_folder(folder_id, data["name"])
            return success_response(
                data={"folder": folder.to_dict()},
                message="Folder renamed successfully",
            )

        # Move
        if "parent_id" in data:
            parent_id = data["parent_id"]
            parent_id_int = None

            if parent_id is not None:
                try:
                    parent_id_int = int(parent_id)
                except (ValueError, TypeError):
                    return error_response("Invalid parent folder ID", "INVALID_FOLDER_ID", 400)

            folder = service.move_folder(folder_id, parent_id_int)
            return success_response(
                data={"folder": folder.to_dict()},
                message="Folder moved successfully",
            )

        return error_response("No valid update fields provided", "INVALID_UPDATE", 400)

    except ValidationError as e:
        return error_response(e.message, e.code, 400)
    except Exception as e:
        logger.exception("Error updating folder %s", folder_id)
        return error_response("Failed to update folder", "INTERNAL_ERROR", 500)


@folders_bp.route("/api/folders/<int:folder_id>", methods=["DELETE"])
@limiter.limit("30 per minute")
def delete_folder(folder_id):
    """Delete a folder."""
    try:
        data = request.get_json(silent=True) or {}
        delete_contents = data.get("delete_contents", False)

        service = get_file_service()
        service.delete_folder(folder_id, delete_contents=bool(delete_contents))

        return success_response(
            data={"id": folder_id},
            message="Folder deleted successfully",
        )

    except ValidationError as e:
        return error_response(e.message, e.code, 400)
    except Exception as e:
        logger.exception("Error deleting folder %s", folder_id)
        return error_response("Failed to delete folder", "INTERNAL_ERROR", 500)