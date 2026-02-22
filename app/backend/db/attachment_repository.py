"""Case attachment repository."""

from __future__ import annotations

import re
import sqlite3
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from models.schemas import CaseAttachment

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "payscope.db"
ATTACHMENTS_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "files" / "case_attachments"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _sanitize_filename(name: str) -> str:
    return re.sub(r"[^\w\-.]", "_", name)[:80]


def add_attachment(case_id: str, filename: str, form_type: str, pdf_bytes: bytes) -> CaseAttachment:
    """Save filled PDF and register attachment. Returns the created CaseAttachment."""
    attachment_id = f"ATT-{uuid4().hex[:12].upper()}"
    now = datetime.utcnow().isoformat()
    safe_name = _sanitize_filename(filename)
    storage_filename = f"{attachment_id}_{safe_name}"
    case_dir = ATTACHMENTS_ROOT / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    storage_path = case_dir / storage_filename
    storage_path.write_bytes(pdf_bytes)

    relative_path = f"{case_id}/{storage_filename}"

    conn = _get_conn()
    try:
        conn.execute(
            """
            INSERT INTO case_attachments (id, case_id, filename, form_type, storage_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (attachment_id, case_id, filename, form_type, relative_path, now),
        )
        conn.commit()
    finally:
        conn.close()

    return CaseAttachment(
        id=attachment_id,
        filename=filename,
        form_type=form_type,
        created_at=datetime.fromisoformat(now),
    )


def list_attachments(case_id: str) -> list[CaseAttachment]:
    """List all attachments for a case."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT id, filename, form_type, created_at FROM case_attachments WHERE case_id = ? ORDER BY created_at DESC",
            (case_id,),
        ).fetchall()
        return [
            CaseAttachment(
                id=r["id"],
                filename=r["filename"],
                form_type=r["form_type"],
                created_at=datetime.fromisoformat(r["created_at"]),
            )
            for r in rows
        ]
    finally:
        conn.close()


def get_attachment_path(case_id: str, attachment_id: str) -> Path | None:
    """Return full path to attachment file, or None if not found."""
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT storage_path FROM case_attachments WHERE case_id = ? AND id = ?",
            (case_id, attachment_id),
        ).fetchone()
        if not row:
            return None
        return ATTACHMENTS_ROOT / row["storage_path"]
    finally:
        conn.close()
