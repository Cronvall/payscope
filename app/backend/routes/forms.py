"""Form filling and case attachments API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from db.attachment_repository import add_attachment, get_attachment_path, list_attachments
from services.form_filler import fill_form, list_available_forms

router = APIRouter(tags=["forms"])


@router.get("/forms")
async def list_forms():
    """List available form types for filling."""
    return list_available_forms()


@router.post("/cases/{case_id}/forms/fill")
async def fill_case_form(case_id: str, body: dict):
    """Fill a form with case data and save as attachment. Returns attachment metadata."""
    form_key = body.get("form_key")
    if not form_key:
        raise HTTPException(status_code=400, detail="Missing form_key")
    try:
        pdf_bytes = fill_form(case_id, form_key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    display_name = next(
        (f["display_name"] for f in list_available_forms() if f["key"] == form_key),
        form_key,
    )
    filename = f"{form_key}_filled_{case_id}.pdf"
    attachment = add_attachment(case_id, filename, form_key, pdf_bytes)
    return {
        "attachment_id": attachment.id,
        "filename": attachment.filename,
        "form_type": attachment.form_type,
        "created_at": attachment.created_at.isoformat(),
    }


@router.get("/cases/{case_id}/attachments")
async def get_case_attachments(case_id: str):
    """List attachments for a case."""
    attachments = list_attachments(case_id)
    return [
        {
            "id": a.id,
            "filename": a.filename,
            "form_type": a.form_type,
            "created_at": a.created_at.isoformat(),
        }
        for a in attachments
    ]


@router.get("/cases/{case_id}/attachments/{attachment_id}")
async def download_attachment(case_id: str, attachment_id: str):
    """Download an attachment as PDF file."""
    path = get_attachment_path(case_id, attachment_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Attachment not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.name,
        headers={"Content-Disposition": f'attachment; filename="{path.name}"'},
    )
