"""
File model — stores metadata only.
The actual file binary lives in Telegram.
"""

from datetime import datetime, timezone

from extensions import db


class File(db.Model):
    """Metadata for a file stored in Telegram."""

    __tablename__ = "files"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    original_name = db.Column(db.String(255), nullable=False)
    telegram_file_id = db.Column(db.String(512), nullable=False, unique=True, index=True)
    telegram_file_unique_id = db.Column(db.String(512), nullable=False, unique=True, index=True)
    telegram_message_id = db.Column(db.BigInteger, nullable=False, unique=True, index=True)
    file_size = db.Column(db.BigInteger, nullable=False, default=0)
    mime_type = db.Column(db.String(255), nullable=True, index=True)
    extension = db.Column(db.String(64), nullable=True, index=True)
    folder_id = db.Column(db.Integer, db.ForeignKey("folders.id"), nullable=True, index=True)
    is_starred = db.Column(db.Boolean, nullable=False, default=False, index=True)
    is_trashed = db.Column(db.Boolean, nullable=False, default=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    folder = db.relationship("Folder", backref=db.backref("files", lazy="dynamic"))

    __table_args__ = (
        db.Index("ix_files_name_lower", db.func.lower(name)),
        db.Index("ix_files_folder_trashed", folder_id, is_trashed),
        db.Index("ix_files_trashed_starred", is_trashed, is_starred),
    )

    def to_dict(self, include_folder=False):
        """Serialize to a dictionary for API responses."""
        data = {
            "id": self.id,
            "name": self.name,
            "original_name": self.original_name,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "extension": self.extension,
            "folder_id": self.folder_id,
            "is_starred": self.is_starred,
            "is_trashed": self.is_trashed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_folder and self.folder:
            data["folder"] = self.folder.to_dict()

        return data