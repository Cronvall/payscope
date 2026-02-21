"""Case lifecycle API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from db.case_repository import get_case, list_cases, transition_status
from models.schemas import CaseStatus

router = APIRouter(prefix="/cases", tags=["cases"])


@router.get("")
async def list_cases_endpoint():
    """List all cases."""
    return list_cases()


@router.get("/{case_id}")
async def get_case_endpoint(case_id: str):
    """Get a case by id."""
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.patch("/{case_id}")
async def patch_case_endpoint(case_id: str, body: dict):
    """Transition case status."""
    status_val = body.get("status")
    if not status_val:
        raise HTTPException(status_code=400, detail="Missing status")
    try:
        to_status = CaseStatus(status_val)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status_val}")
    note = body.get("note")

    try:
        case = transition_status(case_id, to_status, note)
        return case.model_dump(mode="json")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
