from fastapi import APIRouter

from models.schemas import ExpectedPayment, ReceivedPayment
from services.data_loader import load_expected_payments, load_received_payments

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/expected", response_model=list[ExpectedPayment])
async def get_expected_payments():
    return load_expected_payments()


@router.get("/received", response_model=list[ReceivedPayment])
async def get_received_payments():
    return load_received_payments()
