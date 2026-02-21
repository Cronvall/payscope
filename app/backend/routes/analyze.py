from fastapi import APIRouter, HTTPException

from models.schemas import AnalyzeRequest, AnalyzeResponse, Discrepancy
from services.anthropic_client import analyze_discrepancy
from services.data_loader import load_expected_payments, load_received_payments
from services.reconciliation import reconcile

router = APIRouter(tags=["analysis"])

_reconciliation_cache: dict[str, Discrepancy] | None = None


def _get_discrepancy_by_id(disc_id: str) -> Discrepancy | None:
    global _reconciliation_cache
    if _reconciliation_cache is None:
        result = reconcile(load_expected_payments(), load_received_payments())
        _reconciliation_cache = {d.id: d for d in result.discrepancies}
    return _reconciliation_cache.get(disc_id)


@router.post("/analyze", response_model=AnalyzeResponse)
async def run_analysis(request: AnalyzeRequest):
    disc = request.discrepancy
    if disc is None and request.discrepancy_id:
        disc = _get_discrepancy_by_id(request.discrepancy_id)
        if disc is None:
            raise HTTPException(status_code=404, detail=f"Discrepancy {request.discrepancy_id} not found")
    if disc is None:
        raise HTTPException(status_code=400, detail="Provide either discrepancy or discrepancy_id")

    try:
        analysis = await analyze_discrepancy(disc)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return AnalyzeResponse(analysis=analysis)
