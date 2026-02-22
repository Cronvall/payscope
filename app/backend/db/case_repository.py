"""SQLite case repository."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

from models.schemas import (
    ActionItemReference,
    Case,
    CaseStatus,
    CaseStatusHistoryEntry,
)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "payscope.db"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

VALID_STATUSES = {s.value for s in CaseStatus}
TERMINAL_STATUSES = {CaseStatus.RECOVERED, CaseStatus.WRITTEN_OFF}


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    conn = _get_conn()
    try:
        conn.executescript(SCHEMA_PATH.read_text())
        conn.commit()
        # Migration: add jurisdiction column if missing (existing DBs)
        try:
            conn.execute("ALTER TABLE cases ADD COLUMN jurisdiction TEXT DEFAULT ''")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # column already exists
        try:
            conn.execute("ALTER TABLE cases ADD COLUMN security TEXT DEFAULT ''")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # column already exists
    finally:
        conn.close()


def _row_to_case(row: sqlite3.Row) -> Case:
    steps = json.loads(row["steps"]) if row["steps"] else []
    refs_raw = json.loads(row["refs"]) if row["refs"] else []
    refs = [ActionItemReference(title=r["title"], url=r["url"]) for r in refs_raw]

    conn = _get_conn()
    history_rows = conn.execute(
        "SELECT from_status, to_status, changed_at, note FROM case_history WHERE case_id = ? ORDER BY changed_at",
        (row["id"],),
    ).fetchall()
    conn.close()

    history = [
        CaseStatusHistoryEntry(
            from_status=h["from_status"],
            to_status=h["to_status"],
            changed_at=datetime.fromisoformat(h["changed_at"]),
            note=h["note"],
        )
        for h in history_rows
    ]

    return Case(
        id=row["id"],
        errand_id=row["errand_id"],
        client_id=row["client_id"],
        custodian=row["custodian"],
        type=row["type"],
        amount_recoverable=row["amount_recoverable"],
        currency=row["currency"],
        steps=steps,
        references=refs,
        status=CaseStatus(row["status"]),
        jurisdiction=(row["jurisdiction"] or "") if "jurisdiction" in row.keys() else "",
        security=(row["security"] or "") if "security" in row.keys() else "",
        history=history,
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def upsert_case(case_dict: dict) -> Case:
    """Create or update a case. If exists, preserve status/history, refresh steps/references."""
    now = datetime.utcnow().isoformat()
    case_id = case_dict["id"]

    conn = _get_conn()
    try:
        existing = conn.execute("SELECT id, status, created_at FROM cases WHERE id = ?", (case_id,)).fetchone()

        steps_json = json.dumps(case_dict.get("steps", []))
        refs = case_dict.get("references") or []
        refs_json = json.dumps([{"title": r.get("title", ""), "url": r.get("url", "")} for r in refs])

        jurisdiction = (case_dict.get("jurisdiction") or "").strip()[:64]
        security = (case_dict.get("security") or "").strip()[:128]

        if existing:
            created_at = existing["created_at"]
            status = existing["status"]
            conn.execute(
                """
                UPDATE cases SET
                    errand_id = ?, client_id = ?, custodian = ?, type = ?,
                    amount_recoverable = ?, currency = ?, steps = ?, refs = ?,
                    jurisdiction = ?, security = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    case_dict["errand_id"],
                    case_dict["client_id"],
                    case_dict["custodian"],
                    case_dict["type"],
                    case_dict["amount_recoverable"],
                    case_dict["currency"],
                    steps_json,
                    refs_json,
                    jurisdiction,
                    security,
                    now,
                    case_id,
                ),
            )
        else:
            created_at = now
            status = CaseStatus.AI_ANALYZED.value
            conn.execute(
                """
                INSERT INTO cases (id, errand_id, client_id, custodian, type, amount_recoverable, currency, steps, refs, status, jurisdiction, security, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    case_id,
                    case_dict["errand_id"],
                    case_dict["client_id"],
                    case_dict["custodian"],
                    case_dict["type"],
                    case_dict["amount_recoverable"],
                    case_dict["currency"],
                    steps_json,
                    refs_json,
                    status,
                    jurisdiction,
                    security,
                    created_at,
                    now,
                ),
            )
        conn.commit()

        row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
        return _row_to_case(row)
    finally:
        conn.close()


def get_case(case_id: str) -> Case | None:
    """Fetch a case by id."""
    conn = _get_conn()
    try:
        row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
        if not row:
            return None
        return _row_to_case(row)
    finally:
        conn.close()


def list_cases() -> list[Case]:
    """List all cases."""
    conn = _get_conn()
    try:
        rows = conn.execute("SELECT * FROM cases ORDER BY created_at DESC").fetchall()
        return [_row_to_case(r) for r in rows]
    finally:
        conn.close()


def _validate_transition(from_status: CaseStatus, to_status: CaseStatus) -> None:
    """Validate that the transition is allowed. Raises ValueError if not."""
    if from_status == to_status:
        raise ValueError(f"Already in status {to_status.value}")
    if from_status in TERMINAL_STATUSES:
        raise ValueError(f"Cannot transition from terminal status {from_status.value}")
    if to_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status {to_status}")


def transition_status(case_id: str, to_status: CaseStatus, note: str | None = None) -> Case:
    """Transition case to new status, append history. Returns updated Case."""
    conn = _get_conn()
    try:
        row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
        if not row:
            raise ValueError(f"Case not found: {case_id}")

        from_status = CaseStatus(row["status"])
        _validate_transition(from_status, to_status)

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE cases SET status = ?, updated_at = ? WHERE id = ?",
            (to_status.value, now, case_id),
        )
        conn.execute(
            "INSERT INTO case_history (case_id, from_status, to_status, changed_at, note) VALUES (?, ?, ?, ?, ?)",
            (case_id, from_status.value, to_status.value, now, note),
        )
        conn.commit()

        updated = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
        return _row_to_case(updated)
    finally:
        conn.close()
