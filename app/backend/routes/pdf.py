import asyncio

from fastapi import APIRouter, HTTPException

from models.schemas import PDFExtractRequest, PDFExtraction, PDFListItem
from services.pdf_parser import extract_pdf, list_pdfs

router = APIRouter(prefix="/pdf", tags=["pdf"])


@router.get("/list", response_model=list[PDFListItem])
async def get_pdf_list():
    return list_pdfs()


@router.post("/extract", response_model=list[PDFExtraction])
async def extract_pdfs(request: PDFExtractRequest):
    tasks = []
    for filename in request.filenames:
        tasks.append(_safe_extract(filename))
    return await asyncio.gather(*tasks)


async def _safe_extract(filename: str) -> PDFExtraction:
    try:
        return await extract_pdf(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"PDF not found: {filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract {filename}: {e}")
