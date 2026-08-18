"""
Telegram Storage Service.

Handles all Telegram Bot API interactions for file storage.
Telegram is the actual file storage backend; SQLite stores metadata only.

Upload flow:
    Local/temporary upload -> Telegram -> message_id, file_id, file_unique_id

Download flow:
    SQLite file record -> Telegram file_id -> Telegram getFile -> File stream

Delete flow:
    SQLite file record -> Telegram message_id -> Telegram deleteMessage
"""

import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)


class TelegramStorageError(Exception):
    """Base error for Telegram storage operations."""

    def __init__(self, message: str, status_code: int = 500, telegram_error: Optional[dict] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.telegram_error = telegram_error


class TelegramUploadError(TelegramStorageError):
    """Raised when uploading a file to Telegram fails."""


class TelegramDownloadError(TelegramStorageError):
    """Raised when downloading a file from Telegram fails."""


class TelegramDeleteError(TelegramStorageError):
    """Raised when deleting a file from Telegram fails."""


class TelegramFileNotFoundError(TelegramStorageError):
    """Raised when a file cannot be found on Telegram."""


class TelegramStorageService:
    """
    Service for interacting with Telegram Bot API.

    Files are sent as documents to the configured storage chat/channel.
    The Telegram message_id, file_id, and file_unique_id are persisted
    in SQLite so metadata and the actual file can be correlated.
    """

    API_BASE = "https://api.telegram.org/bot{token}"
    FILE_BASE = "https://api.telegram.org/file/bot{token}"

    def __init__(self, bot_token: str, chat_id: str, timeout: int = 120):
        if not bot_token:
            raise ValueError("TELEGRAM_BOT_TOKEN is not configured")
        if not chat_id:
            raise ValueError("TELEGRAM_CHAT_ID is not configured")

        self.bot_token = bot_token
        self.chat_id = str(chat_id).strip()
        self.timeout = timeout
        self.api_base = self.API_BASE.format(token=bot_token)
        self.file_base = self.FILE_BASE.format(token=bot_token)

    def _api_url(self, method: str) -> str:
        return f"{self.api_base}/{method}"

    def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        """
        Make a request to the Telegram API and validate the JSON response.

        Returns the `result` payload dict; raises TelegramStorageError subclasses
        on failure so callers can map to HTTP responses cleanly.
        """
        url = self._api_url(endpoint)
        response = None

        try:
            response = requests.request(method, url, timeout=self.timeout, **kwargs)
            response.raise_for_status()
        except requests.exceptions.HTTPError:
            assert response is not None
            try:
                payload = response.json()
            except ValueError:
                payload = {}
            description = payload.get("description", "Unknown Telegram error")
            status_code = payload.get("error_code", response.status_code)

            if "message to delete not found" in description.lower():
                raise TelegramDeleteError(
                    self._describe("deleteMessage", description),
                    status_code=404,
                    telegram_error=payload,
                )

            if "not found" in description.lower() or status_code == 404:
                raise TelegramFileNotFoundError(
                    self._describe(endpoint, description),
                    status_code=404,
                    telegram_error=payload,
                )

            raise TelegramStorageError(
                self._describe(endpoint, description),
                status_code=status_code,
                telegram_error=payload,
            )
        except requests.exceptions.Timeout:
            raise TelegramStorageError(
                f"Telegram API request timed out for {endpoint}",
                status_code=504,
            )
        except requests.exceptions.RequestException as e:
            raise TelegramStorageError(
                f"Telegram API request failed for {endpoint}: {e}",
                status_code=502,
            )

        try:
            data = response.json()
        except ValueError:
            raise TelegramStorageError(
                f"Invalid JSON response from Telegram for {endpoint}",
                status_code=502,
            )

        if not data.get("ok"):
            description = data.get("description", "Unknown Telegram error")
            status_code = data.get("error_code", 500)

            if "message to delete not found" in description.lower():
                raise TelegramDeleteError(
                    self._describe("deleteMessage", description),
                    status_code=404,
                    telegram_error=data,
                )

            if "not found" in description.lower() or status_code == 404:
                raise TelegramFileNotFoundError(
                    self._describe(endpoint, description),
                    status_code=404,
                    telegram_error=data,
                )

            raise TelegramStorageError(
                self._describe(endpoint, description),
                status_code=status_code,
                telegram_error=data,
            )

        return data.get("result", {})

    @staticmethod
    def _describe(endpoint: str, description: str) -> str:
        return f"Telegram {endpoint} failed: {description}"

    # ------------------------------------------------------------------
    # Upload
    # ------------------------------------------------------------------
    def upload_file(self, file_path: str, original_filename: Optional[str] = None) -> dict:
        """
        Upload a local file to the Telegram storage chat.

        Returns a normalized dict:
        {
            "telegram_file_id": str,
            "telegram_file_unique_id": str,
            "telegram_message_id": int,
            "file_size": int,
            "mime_type": str | None,
            "file_name": str,
        }
        """
        if not file_path or not os.path.isfile(file_path):
            raise TelegramUploadError("Local file not found for upload", status_code=400)

        filename = original_filename or os.path.basename(file_path)

        with open(file_path, "rb") as fh:
            try:
                response = requests.post(
                    self._api_url("sendDocument"),
                    data={"chat_id": self.chat_id},
                    files={"document": (filename, fh)},
                    timeout=self.timeout,
                )
            except requests.exceptions.Timeout:
                raise TelegramUploadError("Telegram upload timed out", status_code=504)
            except requests.exceptions.RequestException as e:
                raise TelegramUploadError(f"Telegram upload request failed: {e}", status_code=502)

        try:
            data = response.json()
        except ValueError:
            raise TelegramUploadError("Invalid JSON response from Telegram during upload", status_code=502)

        if not data.get("ok"):
            raise TelegramUploadError(self._describe("sendDocument", data.get("description", "unknown error")), status_code=500, telegram_error=data)

        result = data.get("result", {})
        document = result.get("document") or {}

        message_id = result.get("message_id")
        file_id = document.get("file_id")
        file_unique_id = document.get("file_unique_id")

        if not file_id or file_unique_id is None or message_id is None:
            raise TelegramUploadError("Telegram did not return file document info", status_code=500, telegram_error=data)

        return {
            "telegram_file_id": file_id,
            "telegram_file_unique_id": file_unique_id,
            "telegram_message_id": int(message_id),
            "file_size": int(document.get("file_size", 0)),
            "mime_type": document.get("mime_type"),
            "file_name": document.get("file_name") or filename,
        }

    # ------------------------------------------------------------------
    # Get file info
    # ------------------------------------------------------------------
    def get_file_info(self, file_id: str) -> dict:
        """
        Retrieve file metadata from Telegram (file_path, size, etc.).

        Returns:
        {
            "file_id": str,
            "file_unique_id": str,
            "file_size": int,
            "file_path": str,
        }
        """
        result = self._request("GET", "getFile", params={"file_id": file_id})

        file_path = result.get("file_path")

        if not file_path:
            raise TelegramFileNotFoundError("Telegram getFile returned no file_path", status_code=404)

        return {
            "file_id": result.get("file_id", file_id),
            "file_unique_id": result.get("file_unique_id", ""),
            "file_size": int(result.get("file_size", 0)),
            "file_path": file_path,
        }

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------
    def download_file(self, file_id: str):
        """
        Stream a file from Telegram.

        Returns a requests.Response with `stream=True`.
        Caller is responsible for closing the response after iterating chunks.
        """
        info = self.get_file_info(file_id)
        file_path = info["file_path"]

        url = f"{self.file_base}/{file_path}"

        try:
            response = requests.get(url, stream=True, timeout=self.timeout)
        except requests.exceptions.Timeout:
            raise TelegramDownloadError("Telegram download timed out", status_code=504)
        except requests.exceptions.RequestException as e:
            raise TelegramDownloadError(f"Telegram download failed: {e}", status_code=502)

        if response.status_code != 200:
            response.close()
            raise TelegramDownloadError(
                f"Telegram download returned HTTP {response.status_code}",
                status_code=502,
            )

        return response

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------
    def delete_file(self, message_id: int) -> bool:
        """
        Delete a message (file) from the Telegram storage chat.

        Prefer passing the DB-stored telegram_message_id.
        """
        self._request(
            "POST",
            "deleteMessage",
            json={"chat_id": self.chat_id, "message_id": int(message_id)},
        )
        return True