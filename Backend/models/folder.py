"""
Folder model — supports nested folder structures.
"""

from datetime import datetime, timezone

from extensions import db


class Folder(db.Model):
    """A folder in the TeleDrive file hierarchy."""

    __tablename__ = "folders"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("folders.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    parent = db.relationship(
        "Folder",
        remote_side=[id],
        backref=db.backref("subfolders", lazy="dynamic")
    )

    __table_args__ = (
        db.Index("ix_folders_parent_name", parent_id, db.func.lower(name)),
    )

    def to_dict(self, include_children=False):
        """Serialize to a dictionary for API responses."""
        data = {
            "id": self.id,
            "name": self.name,
            "parent_id": self.parent_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_children:
            subfolder_count = self.subfolders.count()
            file_count = self.files.filter_by(is_trashed=False).count()

            data["subfolder_count"] = subfolder_count
            data["file_count"] = file_count

        return data

    def get_ancestors(self):
        """
        Return the list of ancestor folders from root to parent.

        Used for breadcrumb navigation.
        """
        ancestors = []
        current = self.parent

        seen = set()

        while current is not None and current.id not in seen:
            ancestors.append(current)
            seen.add(current.id)
            current = current.parent

        return list(reversed(ancestors))