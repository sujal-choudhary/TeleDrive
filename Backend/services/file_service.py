"""
File service — business logic for file operations.

Coordinates between the Flask routes, SQLite metadata, and the
Telegram storage service.
"""

import logging
import os
import tempfile

from werkzeug.utils import secure_filename

from extensions import db
from models import File, Folder
from services.telegram_storage import (
    TelegramStorageService,
    TelegramStorageError,
    TelegramUploadError,
    TelegramDownloadError,
    TelegramDeleteError,
    TelegramFileNotFoundError,
)
from utils.validators import (
    ValidationError,
    validate_filename,
    validate_mime_type,
    validate_file_size,
    validate_folder_name,
    get_extension,
)

logger = logging.getLogger(__name__)

# Maximum upload size from config (set in app factory)
MAX_UPLOAD_SIZE = 10 * 1024 * 1024 * 1024  # default 10 GB

# File type filter categories
FILE_TYPE_FILTERS = {
    "image": ["image/"],
    "video": ["video/"],
    "audio": ["audio/"],
    "document": [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/csv",
        "text/plain; charset=utf-8",
        "application/json",
        "application/zip",
        "application/x-tar",
        "application/x-7z-compressed",
        "application/gzip",
        "application/x-rar-compressed",
    ],
    "archive": ["application/zip", "application/x-tar", "application/x-7z-compressed", "application/gzip", "application/x-rar-compressed"],
    "code": ["application/javascript", "text/css", "application/json", "application/xml", "text/x-python", "text/x-java-source"],
    "text": ["text/plain"],
}


def create_file_service(telegram_service: TelegramStorageService, max_upload_size: int = MAX_UPLOAD_SIZE):
    """Factory to create a file service bound to a Telegram service."""
    return FileService(telegram_service, max_upload_size)


class FileService:
    """Business logic for file operations."""

    def __init__(self, telegram_service: TelegramStorageService, max_upload_size: int = MAX_UPLOAD_SIZE):
        self.telegram = telegram_service
        self.max_upload_size = max_upload_size

    # ------------------------------------------------------------------
    # Upload
    # ------------------------------------------------------------------
    def upload_files(self, files, folder_id=None, paths=None):
        """
        Validate and upload one or more files.

        Args:
            files: Flask request.files.getlist("file") iterator
            folder_id: Optional target folder id
            paths: Optional list of relative paths for each file (for folder uploads)

        Returns:
            List of created File records.

        Raises:
            ValidationError: If folder doesn't exist or files invalid
            TelegramUploadError: If Telegram upload fails
        """
        uploaded = []

        # Validate folder if provided
        if folder_id is not None:
            folder = Folder.query.get(folder_id)
            if not folder:
                raise ValidationError("Folder not found", "FOLDER_NOT_FOUND")

        for i, file in enumerate(files):
            if not file or not file.filename:
                continue

            original_name = file.filename

            # Determine target folder (create nested folders if path provided)
            target_folder_id = folder_id
            if paths and i < len(paths) and paths[i]:
                target_folder_id = self._ensure_folder_path(folder_id, paths[i])

            # Sanitize and validate filename (path traversal protection)
            safe_name = validate_filename(original_name)

            # Get size
            file.stream.seek(0, os.SEEK_END)
            file_size = file.stream.tell()
            file.stream.seek(0)

            # Validate size
            validate_file_size(file_size, self.max_upload_size)

            # Get MIME type
            mime_type = file.mimetype or "application/octet-stream"

            # Validate MIME type
            mime_type = validate_mime_type(mime_type, safe_name)

            # Save to temporary file (unique path to avoid collisions)
            temp_dir = tempfile.gettempdir()
            temp_name = secure_filename(f"teledrive_{original_name}")
            temp_path = os.path.join(temp_dir, f"{temp_name}_{os.getpid()}_{id(file)}")

            try:
                file.save(temp_path)

                # Upload to Telegram
                telegram_info = self.telegram.upload_file(temp_path, safe_name)

                # Get extension
                extension = get_extension(safe_name)

                # Create metadata record
                file_record = File(
                    name=safe_name,
                    original_name=original_name,
                    telegram_file_id=telegram_info["telegram_file_id"],
                    telegram_file_unique_id=telegram_info["telegram_file_unique_id"],
                    telegram_message_id=telegram_info["telegram_message_id"],
                    file_size=telegram_info["file_size"],
                    mime_type=telegram_info.get("mime_type") or mime_type,
                    extension=extension,
                    folder_id=target_folder_id,
                )

                db.session.add(file_record)
                uploaded.append(file_record)

            finally:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except OSError:
                        logger.warning("Could not remove temp file: %s", temp_path)

        db.session.commit()

        return uploaded

    # ------------------------------------------------------------------
    # List / Get
    # ------------------------------------------------------------------
    def list_files(
        self,
        folder_id=None,
        search=None,
        starred=None,
        trashed=None,
        file_type=None,
        sort_by="name",
        sort_order="asc",
        include_trashed=False,
    ):
        """
        List files with optional filters.

        Args:
            folder_id: Filter by folder (None = root folder)
            search: Search by name/extension/mime
            starred: Filter is_starred
            trashed: Filter is_trashed
            file_type: Filter by type category (image, video, audio, document, archive, code, text)
            sort_by: Field to sort by (name, size, created_at, updated_at, type)
            sort_order: "asc" or "desc"

        Returns:
            List of File records.
        """
        query = File.query

        # Folder filter
        # When browsing trash, show trashed files from all folders
        browsing_trash = trashed is True
        if folder_id is not None:
            query = query.filter(File.folder_id == folder_id)
        elif not include_trashed and not search and not browsing_trash:
            # Only filter to root when not searching or browsing trash
            query = query.filter(File.folder_id.is_(None))

        # Trash filter
        if trashed is True:
            query = query.filter(File.is_trashed.is_(True))
        elif trashed is False:
            query = query.filter(File.is_trashed.is_(False))
        elif not include_trashed:
            query = query.filter(File.is_trashed.is_(False))

        # Starred filter
        if starred is not None:
            query = query.filter(File.is_starred.is_(starred))

        # Search
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    File.name.ilike(search_term),
                    File.extension.ilike(search_term),
                    File.mime_type.ilike(search_term),
                    File.original_name.ilike(search_term),
                )
            )

        # File type filter
        if file_type and file_type in FILE_TYPE_FILTERS:
            mime_prefixes = FILE_TYPE_FILTERS[file_type]

            conditions = []

            for prefix in mime_prefixes:
                if prefix.endswith("/"):
                    conditions.append(File.mime_type.like(f"{prefix}%"))
                else:
                    conditions.append(File.mime_type == prefix)

            query = query.filter(db.or_(*conditions))

        # Sorting
        sort_column = None

        if sort_by == "size":
            sort_column = File.file_size
            display_name = "file_size"
        elif sort_by == "created_at":
            sort_column = File.created_at
            display_name = "created_at"
        elif sort_by == "updated_at":
            sort_column = File.updated_at
            display_name = "updated_at"
        elif sort_by == "type":
            sort_column = File.mime_type
            display_name = "mime_type"
        else:  # name (default)
            sort_column = db.func.lower(File.name)
            display_name = "name"

        if sort_order.lower() == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        return query.all()

    def get_file(self, file_id):
        """Get a single file by ID or raise ValidationError."""
        file = File.query.get(file_id)
        if not file:
            raise ValidationError("File not found", "FILE_NOT_FOUND")
        return file

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------
    def download_file(self, file_id):
        """
        Stream a file from Telegram.

        Returns a tuple: (response, file_record)
        The caller must iterate response.iter_content() and close it.
        """
        file = self.get_file(file_id)

        try:
            telegram_response = self.telegram.download_file(file.telegram_file_id)
        except TelegramStorageError as e:
            logger.error("Download failed for file %s: %s", file_id, e.message)
            raise

        return telegram_response, file

    # ------------------------------------------------------------------
    # Rename / Move / Star / Trash / Restore
    # ------------------------------------------------------------------
    def rename_file(self, file_id, new_name):
        """Rename a file."""
        file = self.get_file(file_id)

        safe_name = validate_filename(new_name)

        # Check for duplicate name in same folder
        existing = File.query.filter(
            File.folder_id == file.folder_id,
            File.name == safe_name,
            File.id != file_id,
            File.is_trashed.is_(False),
        ).first()

        if existing:
            raise ValidationError("A file with this name already exists", "DUPLICATE_NAME")

        file.name = safe_name
        file.extension = get_extension(safe_name)

        db.session.commit()

        return file

    def move_file(self, file_id, folder_id):
        """Move a file to another folder."""
        file = self.get_file(file_id)

        # Validate target folder
        if folder_id is not None:
            folder = Folder.query.get(folder_id)
            if not folder:
                raise ValidationError("Folder not found", "FOLDER_NOT_FOUND")

        file.folder_id = folder_id

        db.session.commit()

        return file

    def toggle_star(self, file_id, is_starred):
        """Star or unstar a file."""
        file = self.get_file(file_id)
        file.is_starred = bool(is_starred)
        db.session.commit()
        return file

    def trash_file(self, file_id, is_trashed=True):
        """Move a file to trash (or restore it)."""
        file = self.get_file(file_id)
        file.is_trashed = bool(is_trashed)
        db.session.commit()
        return file

    def delete_file_permanently(self, file_id):
        """
        Permanently delete a file:
        1. Delete from Telegram (message)
        2. Delete from SQLite

        Raises TelegramDeleteError if Telegram deletion fails.
        """
        file = self.get_file(file_id)

        # First, delete from Telegram
        try:
            self.telegram.delete_file(file.telegram_message_id)
        except TelegramDeleteError as e:
            logger.error("Telegram delete failed for file %s: %s", file_id, e.message)
            raise

        # If Telegram deletion succeeded, remove metadata
        db.session.delete(file)
        db.session.commit()

        return True

    def empty_trash(self):
        """
        Permanently delete all files in trash.

        Attempts to delete from Telegram first. If Telegram deletion fails
        for any file, the operation raises and no metadata is deleted
        for the failed file.
        """
        trashed_files = File.query.filter(File.is_trashed.is_(True)).all()

        deleted_count = 0

        for file in trashed_files:
            try:
                self.telegram.delete_file(file.telegram_message_id)
            except TelegramDeleteError as e:
                logger.error("Telegram delete failed for file %s: %s", file.id, e.message)
                raise

            db.session.delete(file)
            deleted_count += 1

        db.session.commit()

        return deleted_count

    # ------------------------------------------------------------------
    # Folders
    # ------------------------------------------------------------------
    def create_folder(self, name, parent_id=None):
        """Create a new folder."""
        clean_name = validate_folder_name(name)

        # Validate parent
        if parent_id is not None:
            parent = Folder.query.get(parent_id)
            if not parent:
                raise ValidationError("Parent folder not found", "FOLDER_NOT_FOUND")

        # Check duplicate
        existing = Folder.query.filter(
            Folder.parent_id == parent_id,
            db.func.lower(Folder.name) == clean_name.lower(),
        ).first()

        if existing:
            raise ValidationError("A folder with this name already exists here", "DUPLICATE_FOLDER")

        folder = Folder(name=clean_name, parent_id=parent_id)
        db.session.add(folder)
        db.session.commit()
        return folder

    def get_folder(self, folder_id):
        """Get a folder or raise ValidationError."""
        folder = Folder.query.get(folder_id)
        if not folder:
            raise ValidationError("Folder not found", "FOLDER_NOT_FOUND")
        return folder

    def list_folders(self, parent_id=None, include_trashed=False):
        """List folders in a given parent (None = root)."""
        query = Folder.query.filter(Folder.parent_id == parent_id)

        # Exclude folders that only contain trashed files
        return query.all()

    def rename_folder(self, folder_id, new_name):
        """Rename a folder."""
        folder = self.get_folder(folder_id)
        clean_name = validate_folder_name(new_name)

        # Check duplicate
        existing = Folder.query.filter(
            Folder.parent_id == folder.parent_id,
            db.func.lower(Folder.name) == clean_name.lower(),
            Folder.id != folder_id,
        ).first()

        if existing:
            raise ValidationError("A folder with this name already exists here", "DUPLICATE_FOLDER")

        folder.name = clean_name
        db.session.commit()
        return folder

    def move_folder(self, folder_id, target_parent_id):
        """Move a folder to another parent."""
        folder = self.get_folder(folder_id)

        if target_parent_id is not None:
            target = self.get_folder(target_parent_id)

            # Prevent circular relationships
            if self._is_descendant(target, folder):
                raise ValidationError("Cannot move a folder into its own descendant", "CIRCULAR_FOLDER")

        folder.parent_id = target_parent_id
        db.session.commit()
        return folder

    def delete_folder(self, folder_id, delete_contents=False):
        """
        Delete a folder.

        If delete_contents is True, recursively move contents to trash
        or delete permanently.
        If False, raises if folder is not empty.
        """
        folder = self.get_folder(folder_id)

        # Check if folder has children
        subfolder_count = folder.subfolders.count()
        file_count = folder.files.filter_by(is_trashed=False).count()

        if not delete_contents and (subfolder_count > 0 or file_count > 0):
            raise ValidationError(
                "Folder is not empty. Move or delete its contents first.",
                "FOLDER_NOT_EMPTY",
            )

        if delete_contents:
            # Recursively delete subfolders and files
            self._delete_folder_contents(folder)

        db.session.delete(folder)
        db.session.commit()

        return True

    def get_folder_breadcrumbs(self, folder_id):
        """Return ancestor chain for breadcrumb navigation."""
        folder = self.get_folder(folder_id)
        ancestors = folder.get_ancestors()
        return [a.to_dict() for a in ancestors]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _ensure_folder_path(self, base_folder_id, relative_path):
        """
        Create nested folders for a relative path and return the final folder ID.

        Args:
            base_folder_id: The parent folder ID (or None for root)
            relative_path: Relative folder path like "subfolder/nested"
                          (the filename is already stripped by the client)

        Returns:
            The ID of the deepest folder in the path.
        """
        # Normalize path separators
        rel_path = relative_path.replace("\\", "/")

        # Split into folder components
        parts = [p for p in rel_path.split("/") if p and p not in {".", ".."}]

        if not parts:
            return base_folder_id

        current_parent_id = base_folder_id

        for part in parts:
            # Validate folder name
            clean_name = validate_folder_name(part)

            # Check if folder already exists
            existing = Folder.query.filter(
                Folder.parent_id == current_parent_id,
                db.func.lower(Folder.name) == clean_name.lower(),
            ).first()

            if existing:
                current_parent_id = existing.id
            else:
                folder = Folder(name=clean_name, parent_id=current_parent_id)
                db.session.add(folder)
                db.session.flush()  # Get the new folder ID
                current_parent_id = folder.id

        return current_parent_id

    def _is_descendant(self, folder, ancestor):
        """Check if `folder` is a descendant of `ancestor` (circular prevention)."""
        current = folder
        seen = set()

        while current is not None and current.id not in seen:
            if current.id == ancestor.id:
                return True
            seen.add(current.id)
            current = current.parent

        return False

    def _delete_folder_contents(self, folder):
        """Recursively delete folder contents (files from Telegram + subfolders)."""
        # Delete files in this folder
        for file in folder.files.all():
            if not file.is_trashed:
                try:
                    self.telegram.delete_file(file.telegram_message_id)
                except TelegramDeleteError as e:
                    logger.error("Telegram delete failed for file %s: %s", file.id, e.message)
                    raise
            db.session.delete(file)

        # Recursively delete subfolders
        for subfolder in folder.subfolders.all():
            self._delete_folder_contents(subfolder)
            db.session.delete(subfolder)