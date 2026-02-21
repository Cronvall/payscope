"""Chat endpoint – orchestrates user free text to tool execution."""

from fastapi import APIRouter, HTTPException

from models.schemas import (
    ChatRequest,
    ChatResponse,
    Discrepancy,
    ReconciliationResult,
)
from services.data_loader import load_expected_payments, load_received_payments
from services.orchestrator import Intent, parse_intent
from services.reconciliation import reconcile
from services.anthropic_client import analyze_discrepancy
from services.pdf_parser import list_pdfs, extract_pdf

router = APIRouter(tags=["chat"])

_reconciliation_cache: dict[str, Discrepancy] | None = None


def _get_discrepancy_by_id(disc_id: str) -> Discrepancy | None:
    global _reconciliation_cache
    if _reconciliation_cache is None:
        result = reconcile(load_expected_payments(), load_received_payments())
        _reconciliation_cache = {d.id: d for d in result.discrepancies}
    return _reconciliation_cache.get(disc_id)


def _clear_reconciliation_cache():
    global _reconciliation_cache
    _reconciliation_cache = None


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    message = (request.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    history = []
    if request.history:
        history = [{"role": t.role, "content": t.content or ""} for t in request.history]

    pdf_filenames = [p.filename for p in list_pdfs()]
    result = parse_intent(message, pdf_filenames, history, request.action_context)

    if result.intent == Intent.RECONCILE:
        _clear_reconciliation_cache()
        recon_result: ReconciliationResult = reconcile(
            load_expected_payments(), load_received_payments()
        )
        global _reconciliation_cache
        _reconciliation_cache = {d.id: d for d in recon_result.discrepancies}
        s = recon_result.summary
        content = (
            f"Reconciliation complete. Found {s.total_discrepancies} discrepancy(ies) "
            f"with ${s.value_at_risk:,.0f} at risk."
        )
        return ChatResponse(
            content=content,
            reconciliation=recon_result,
        )

    if result.intent == Intent.ANALYZE:
        if not result.discrepancy_id:
            return ChatResponse(
                content="Which discrepancy would you like me to analyze? "
                "Try something like 'Analyze DISC-001' or 'Explain DISC-002'.",
            )
        disc = _get_discrepancy_by_id(result.discrepancy_id)
        if disc is None:
            return ChatResponse(
                content=f"Discrepancy {result.discrepancy_id} not found. "
                "Run reconciliation first to see available discrepancies.",
            )
        try:
            analysis = await analyze_discrepancy(disc)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e))
        content = f"AI analysis for {result.discrepancy_id}:"
        return ChatResponse(content=content, analysis=analysis)

    if result.intent == Intent.EXTRACT_PDF:
        if not result.filename:
            return ChatResponse(
                content="Which PDF would you like me to extract? "
                "Click a PDF in the sidebar or mention its filename.",
            )
        try:
            ext = await extract_pdf(result.filename)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"PDF not found: {result.filename}")
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to extract {result.filename}: {e}"
            )
        content = f"Extracted from {result.filename}"
        return ChatResponse(content=content, pdf_extractions=[ext])

    return ChatResponse(
        content=result.general_message
        or "I can help you with reconciliation. Try 'Run reconciliation' to compare expected vs received payments, or click a PDF in the sidebar to extract data.",
    )
