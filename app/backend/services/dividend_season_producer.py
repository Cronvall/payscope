"""Fake data producer for dividend season SSE stream."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

ERANDS_PATH = Path(__file__).resolve().parent.parent.parent.parent / "files" / "dividend_season" / "errands.json"
INTERVAL_SECONDS = 0.5


def _load_errands() -> list[dict]:
    if not ERANDS_PATH.exists():
        return []
    with open(ERANDS_PATH, encoding="utf-8") as f:
        return json.load(f)


async def stream_errands():
    """
    Async generator yielding errands at ~2/sec.
    Yields dicts: {"type": "errand"|"evaluated"|"action", "payload": {...}}
    """
    from services.worthiness import evaluate_errand

    errands = _load_errands()
    action_counter = 0

    for errand in errands:
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
            }
            yield {"type": "action", "payload": action_item}

        await asyncio.sleep(INTERVAL_SECONDS)
