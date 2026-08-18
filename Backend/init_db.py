"""
Database initialization script.

Creates all tables without destroying existing data.
Run: python init_db.py
"""

import os

from dotenv import load_dotenv

load_dotenv()

from app import create_app
from extensions import db
from models import File, Folder  # noqa: F401


def main():
    """Create all database tables (idempotent)."""
    app = create_app()

    with app.app_context():
        # Create tables if they don't exist — never drops existing data
        db.create_all()
        print("Database tables created successfully.")

        # Verify tables exist
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"Tables in database: {', '.join(tables)}")

        # Report counts
        file_count = File.query.count()
        folder_count = Folder.query.count()
        print(f"Files: {file_count}")
        print(f"Folders: {folder_count}")

    print("Database initialization complete.")


if __name__ == "__main__":
    main()