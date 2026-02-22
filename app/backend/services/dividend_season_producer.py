"""Fake data producer for dividend season SSE stream."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

ERANDS_PATH = Path(__file__).resolve().parent.parent.parent.parent / "files" / "dividend_season" / "errands.json"
INTERVAL_SECONDS = 0.5

# ISIN country code (first 2 chars) → jurisdiction display name for team specialization
ISIN_JURISDICTIONS: dict[str, str] = {
    "US": "United States",
    "CA": "Canada",
    "GB": "United Kingdom",
    "DE": "Germany",
    "FR": "France",
    "CH": "Switzerland",
    "JP": "Japan",
    "SE": "Sweden",
    "NO": "Norway",
    "NL": "Netherlands",
    "LU": "Luxembourg",
    "AU": "Australia",
    "KR": "South Korea",
    "HK": "Hong Kong",
    "SG": "Singapore",
    "IE": "Ireland",
    "IT": "Italy",
    "ES": "Spain",
    "FI": "Finland",
    "DK": "Denmark",
    "AT": "Austria",
    "BE": "Belgium",
    "PL": "Poland",
    "BR": "Brazil",
    "IN": "India",
    "CN": "China",
    "TW": "Taiwan",
    "MX": "Mexico",
}


def _jurisdiction_from_errand(errand: dict) -> str:
    """Derive WHT jurisdiction from first payment's ISIN (country of incorporation)."""
    payments = errand.get("payments") or []
    for pay in payments:
        isin = pay.get("isin") or ""
        if len(isin) >= 2:
            code = isin[:2].upper()
            return ISIN_JURISDICTIONS.get(code, code)
    return "Unknown"


def _load_errands() -> list[dict]:
    if not ERANDS_PATH.exists():
        return []
    with open(ERANDS_PATH, encoding="utf-8") as f:
        return json.load(f)


async def stream_errands(*, demo: bool = False):
    """
    Async generator yielding errands at ~2/sec.
    Yields dicts: {"type": "errand"|"evaluated"|"action", "payload": {...}}
    When demo=True, emits only one errand per nation (jurisdiction).
    """
    from services.worthiness import evaluate_errand

    errands = _load_errands()
    action_counter = 0
    seen_jurisdictions: set[str] = set()

    for errand in errands:
        if demo:
            jurisdiction = _jurisdiction_from_errand(errand)
            if jurisdiction in seen_jurisdictions:
                continue
            seen_jurisdictions.add(jurisdiction)
        yield {"type": "errand", "payload": errand}

        eval_result = evaluate_errand(errand)
        yield {"type": "evaluated", "payload": {**eval_result, "errand_id": errand["errand_id"]}}

        if eval_result["worth_it"]:
            action_counter += 1
            action_item = {
                "id": f"ACT-{action_counter:03d}",
                "errand_id": errand["errand_id"],
                "client_id": errand["client_id"],
                "custodian": errand["custodian"],
                "type": eval_result["action_type"],
                "amount_recoverable": eval_result["recoverable_amount"],
                "currency": eval_result["currency"],
                "steps": eval_result["suggested_actions"],
                "references": eval_result.get("suggested_references") or [],
                "status": "pending",
                "jurisdiction": _jurisdiction_from_errand(errand),
            }
            yield {"type": "action", "payload": action_item}

        await asyncio.sleep(INTERVAL_SECONDS)
