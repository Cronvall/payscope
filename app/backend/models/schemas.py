from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class DiscrepancyType(str, Enum):
    TAX_ERROR = "TAX_ERROR"
    MISSING_PAYMENT = "MISSING_PAYMENT"
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    OVERPAYMENT = "OVERPAYMENT"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ExpectedStatus(str, Enum):
    PENDING = "PENDING"
    NO_DIVIDEND = "NO_DIVIDEND"


class SettlementStatus(str, Enum):
    SETTLED = "SETTLED"
    PENDING = "PENDING"
    FAILED = "FAILED"


# ---------------------------------------------------------------------------
# Core payment models – mirror the CSV column structure
# ---------------------------------------------------------------------------

class ExpectedPayment(BaseModel):
    expected_id: str
    isin: str
    sedol: str
    ticker: str
    company_name: str
    ex_date: date
    pay_date: date
    holding_quantity: int
    div_rate: float
    quotation_currency: str
    expected_gross_amount: float
    tax_treaty: str
    tax_treaty_rate: float
    expected_tax: float
    expected_net_amount: float
    custodian: str
    account_number: str
    calculation_date: date
    expected_status: ExpectedStatus


class ReceivedPayment(BaseModel):
    received_id: str
    custodian_ref: str
    isin: str
    sedol: str
    ticker: str
    company_name: str
    pay_date: date
    settlement_date: date
    received_gross_amount: float
    tax_withheld: float
    received_net_amount: float
    settlement_currency: str
    custodian: str
    account_number: str
    received_timestamp: datetime
    settlement_status: SettlementStatus
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Discrepancy & AI analysis
# ---------------------------------------------------------------------------

class AIAnalysis(BaseModel):
    verification_steps: list[str]
    root_cause: str
    explanation: str
    recommendation: str
    recoverable_amount: float
    timeline: str


class Discrepancy(BaseModel):
    id: str
    type: DiscrepancyType
    severity: Severity
    expected: ExpectedPayment
    received: Optional[ReceivedPayment] = None
    discrepancy_amount: float
    detected_at: datetime
    analysis: Optional[AIAnalysis] = None


class ReconciliationSummary(BaseModel):
    total_expected: int
    total_received: int
    total_matched: int
    total_discrepancies: int
    value_at_risk: float


class ReconciliationResult(BaseModel):
    discrepancies: list[Discrepancy]
    matched: list[ExpectedPayment]
    summary: ReconciliationSummary


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------

class ExtractedPayment(BaseModel):
    company: str
    isin: Optional[str] = None
    ticker: Optional[str] = None
    shares: Optional[float] = None
    rate: Optional[float] = None
    gross: Optional[float] = None
    tax: Optional[float] = None
    net: Optional[float] = None
    currency: Optional[str] = None


class PDFExtraction(BaseModel):
    filename: str
    custodian: Optional[str] = None
    account: Optional[str] = None
    date: Optional[str] = None
    payments: list[ExtractedPayment] = Field(default_factory=list)


class PDFListItem(BaseModel):
    filename: str
    size_bytes: int
    custodian_hint: str = ""


# ---------------------------------------------------------------------------
# Request / response wrappers
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    discrepancy_id: Optional[str] = None
    discrepancy: Optional[Discrepancy] = None


class AnalyzeResponse(BaseModel):
    analysis: AIAnalysis


class PDFExtractRequest(BaseModel):
    filenames: list[str]


# ---------------------------------------------------------------------------
# Case lifecycle
# ---------------------------------------------------------------------------

class CaseStatus(str, Enum):
    NEW = "NEW"
    AI_ANALYZED = "AI_ANALYZED"
    UNDER_REVIEW = "UNDER_REVIEW"
    DOCUMENT_REQUESTED = "DOCUMENT_REQUESTED"
    CLAIM_SUBMITTED = "CLAIM_SUBMITTED"
    RECOVERED = "RECOVERED"
    WRITTEN_OFF = "WRITTEN_OFF"


class CaseStatusHistoryEntry(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    changed_at: datetime
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Dividend season / action list
# ---------------------------------------------------------------------------

class ActionItemReference(BaseModel):
    title: str
    url: str


class ActionItem(BaseModel):
    id: str
    errand_id: str
    client_id: str
    custodian: str
    type: str  # tax_reclaim, missing_followup, overpayment_return
    amount_recoverable: float
    currency: str
    steps: list[str]
    references: list[ActionItemReference] = []
    status: str = "pending"


class CaseAttachment(BaseModel):
    """Attachment (filled form PDF) associated with a case."""

    id: str
    filename: str
    form_type: str
    created_at: datetime


class Case(BaseModel):
    """Canonical case model with lifecycle status and history."""

    id: str
    errand_id: str
    client_id: str
    custodian: str
    type: str  # tax_reclaim, missing_followup, overpayment_return
    amount_recoverable: float
    currency: str
    steps: list[str]
    references: list[ActionItemReference] = []
    status: CaseStatus
    jurisdiction: str = ""  # WHT jurisdiction (e.g. Germany, Japan) for team specialization
    history: list[CaseStatusHistoryEntry] = []
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Chat / orchestration
# ---------------------------------------------------------------------------

class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[list[ChatTurn]] = None
    action_context: Optional[dict] = None  # Selected ActionItem for errand-scoped chat


class ChatResponse(BaseModel):
    content: str
    reconciliation: Optional[ReconciliationResult] = None
    analysis: Optional[AIAnalysis] = None
    pdf_extractions: Optional[list[PDFExtraction]] = None
