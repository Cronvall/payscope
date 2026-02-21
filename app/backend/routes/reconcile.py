from fastapi import APIRouter

from models.schemas import ReconciliationResult
from services.data_loader import load_expected_payments, load_received_payments
from services.reconciliation import reconcile

router = APIRouter(tags=["reconciliation"])


@router.post("/reconcile", response_model=ReconciliationResult)
async def run_reconciliation():
    expected = load_expected_payments()
    received = load_received_payments()
    return reconcile(expected, received)
