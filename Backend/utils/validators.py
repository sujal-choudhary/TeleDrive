"""
Validation utilities for file uploads and API requests.
"""

import os
from typing import Optional, Tuple

from werkzeug.utils import secure_filename

# Allowed MIME types and their extensions
ALLOWED_MIME_TYPES = {
    # Images
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "image/gif": {".gif"},
    "image/svg+xml": {".svg"},
    "image/bmp": {".bmp"},
    "image/tiff": {".tiff", ".tif"},
    "image/x-icon": {".ico"},
    # Videos
    "video/mp4": {".mp4"},
    "video/webm": {".webm"},
    "video/quicktime": {".mov"},
    "video/x-msvideo": {".avi"},
    "video/x-matroska": {".mkv"},
    # Audio
    "audio/mpeg": {".mp3"},
    "audio/wav": {".wav"},
    "audio/ogg": {".ogg"},
    "audio/aac": {".aac"},
    "audio/flac": {".flac"},
    "audio/x-m4a": {".m4a"},
    # Documents
    "application/pdf": {".pdf"},
    "application/msword": {".doc"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    "application/vnd.ms-excel": {".xls"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {".xlsx"},
    "application/vnd.ms-powerpoint": {".ppt"},
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {".pptx"},
    "text/plain": {".txt", ".log", ".md", ".csv"},
    "text/csv": {".csv"},
    "text/html": {".html", ".htm"},
    "text/css": {".css"},
    "application/javascript": {".js", ".mjs"},
    "application/json": {".json"},
    "application/xml": {".xml"},
    "application/zip": {".zip"},
    "application/x-tar": {".tar"},
    "application/x-7z-compressed": {".7z"},
    "application/gzip": {".gz"},
    "application/x-rar-compressed": {".rar"},
    "application/octet-stream": set(),  # Fallback for unknown binary types
}

# Extensions that are always blocked regardless of MIME type
# Note: .js, .html, .htm, .svg, .xml are intentionally NOT blocked here
# because they are valid document types in ALLOWED_MIME_TYPES.
# Instead, dangerous MIME types are blocked in validate_mime_type.
BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".com", ".scr", ".pif", ".msi",
    ".vbs", ".jse", ".wsf", ".wsh", ".ps1", ".psm1",
    ".sh", ".bash", ".csh", ".ksh", ".zsh",
    ".php", ".php3", ".php4", ".php5", ".phtml",
    ".asp", ".aspx", ".jsp", ".cgi", ".pl", ".py", ".rb",
    ".jar", ".apk", ".dll", ".sys", ".drv", ".ocx",
    ".hta",
}

# Maximum filename length
MAX_FILENAME_LENGTH = 255

# Maximum folder name length
MAX_FOLDER_NAME_LENGTH = 255


class ValidationError(Exception):
    """Raised when validation fails."""

    def __init__(self, message: str, code: str = "VALIDATION_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


def validate_filename(filename: str) -> str:
    """
    Validate and sanitize a filename.

    Returns:
        The sanitized filename

    Raises:
        ValidationError: If the filename is invalid
    """
    if not filename or not filename.strip():
        raise ValidationError("Filename is required", "INVALID_FILENAME")

    if len(filename) > MAX_FILENAME_LENGTH:
        raise ValidationError(
            f"Filename exceeds maximum length of {MAX_FILENAME_LENGTH} characters",
            "FILENAME_TOO_LONG"
        )

    # Remove any path components (path traversal protection)
    # Use os.path.basename to strip directory components, then sanitize
    base_name = os.path.basename(filename.replace("\\", "/"))

    if not base_name or base_name in {".", ".."}:
        raise ValidationError("Filename contains invalid characters", "INVALID_FILENAME")

    # Try secure_filename first; if it returns empty (e.g. Unicode-only names),
    # fall back to a Unicode-preserving sanitizer
    sanitized = secure_filename(base_name)

    if not sanitized:
        # Preserve Unicode characters but strip path separators and control chars
        sanitized = "".join(
            ch for ch in base_name
            if ch not in '/\\' and ord(ch) >= 32
        ).strip()

    if not sanitized:
        raise ValidationError("Filename contains invalid characters", "INVALID_FILENAME")

    # Check for blocked extensions
    ext = os.path.splitext(sanitized)[1].lower()

    if ext in BLOCKED_EXTENSIONS:
        raise ValidationError(
            f"File extension '{ext}' is not allowed",
            "BLOCKED_EXTENSION"
        )

    return sanitized


def validate_mime_type(mime_type: Optional[str], filename: str) -> str:
    """
    Validate that the MIME type is acceptable.

    Args:
        mime_type: The MIME type from the upload
        filename: The sanitized filename

    Returns:
        The validated MIME type (or application/octet-stream as fallback)

    Raises:
        ValidationError: If the MIME type is explicitly blocked
    """
    if not mime_type:
        return "application/octet-stream"

    mime_type = mime_type.lower()

    # Block dangerous MIME types
    # Note: text/html is intentionally NOT blocked here because it's
    # a valid document type in ALLOWED_MIME_TYPES. Instead, we rely on
    # the extension check below to ensure .html files are served safely.
    if mime_type in {
        "application/x-httpd-php", "application/x-msdownload",
        "application/x-msdos-program", "application/x-sh", "application/x-bat",
        "application/x-msi", "application/x-javascript",
    }:
        raise ValidationError(
            f"MIME type '{mime_type}' is not allowed",
            "BLOCKED_MIME_TYPE"
        )

    # If we know the MIME type, verify the extension matches
    if mime_type in ALLOWED_MIME_TYPES:
        allowed_exts = ALLOWED_MIME_TYPES[mime_type]

        if allowed_exts:  # Skip check for application/octet-stream
            ext = os.path.splitext(filename)[1].lower()

            if ext not in allowed_exts:
                raise ValidationError(
                    f"File extension '{ext}' does not match MIME type '{mime_type}'",
                    "MIME_TYPE_MISMATCH"
                )

    return mime_type


def validate_file_size(file_size: int, max_size: int) -> None:
    """
    Validate that the file size is within limits.

    Args:
        file_size: Size of the file in bytes
        max_size: Maximum allowed size in bytes

    Raises:
        ValidationError: If the file is too large
    """
    if file_size <= 0:
        raise ValidationError("File is empty", "EMPTY_FILE")

    if file_size > max_size:
        max_mb = max_size // (1024 * 1024)
        raise ValidationError(
            f"File exceeds maximum size of {max_mb} MB",
            "FILE_TOO_LARGE"
        )


def validate_folder_name(name: str) -> str:
    """
    Validate a folder name.

    Returns:
        The trimmed folder name

    Raises:
        ValidationError: If the name is invalid
    """
    if not name or not name.strip():
        raise ValidationError("Folder name is required", "INVALID_FOLDER_NAME")

    name = name.strip()

    if len(name) > MAX_FOLDER_NAME_LENGTH:
        raise ValidationError(
            f"Folder name exceeds maximum length of {MAX_FOLDER_NAME_LENGTH} characters",
            "FOLDER_NAME_TOO_LONG"
        )

    # Block path separators and traversal
    if "/" in name or "\\" in name or ".." in name:
        raise ValidationError("Folder name contains invalid characters", "INVALID_FOLDER_NAME")

    return name


def get_extension(filename: str) -> str:
    """Extract the lowercase extension from a filename."""
    ext = os.path.splitext(filename)[1]
    return ext.lower().lstrip(".") if ext else ""