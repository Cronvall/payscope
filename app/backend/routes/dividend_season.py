"""Dividend season SSE stream endpoint."""

from __future__ import annotations

import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from db.case_repository import upsert_case
from services.dividend_season_producer import stream_errands

router = APIRouter(prefix="/dividend-season", tags=["dividend-season"])


async def _event_generator(request: Request):
    try:
        async for event in stream_errands():
            if event.get("type") == "action":
                case = upsert_case(event["payload"])
                event = {"type": "action", "payload": case.model_dump(mode="json")}
            yield f"data: {json.dumps(event)}\n\n"
    except Exception:
        pass


@router.get("/stream")
async def stream(request: Request):
    return StreamingResponse(
        _event_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
