"""Rule-based worthiness evaluation for dividend season errands."""

from __future__ import annotations

import logging

from services.data_loader import load_expected_payments

logger = logging.getLogger(__name__)
WORTHINESS_THRESHOLD = 100.0

FALLBACK_STEPS = {
    "tax_reclaim": ["Submit W-8BEN treaty certification", "Contact custodian tax ops for reclaim"],
    "missing_followup": ["Contact custodian to trace missing payment", "Verify settlement status"],
    "overpayment_return": ["Verify overpayment with custodian", "Return excess if confirmed"],
}

CUSTODIAN_CODE_TO_DISPLAY = {
    "JPMORGAN_CHASE": "JPMorgan Chase & Co.",
    "STATE_STREET_UK": "State Street UK",
    "UBS_SWITZERLAND": "UBS Switzerland",
    "DEUTSCHE_BANK_CUSTODY": "Deutsche Bank Custody",
    "BNP_PARIBAS_SECURITIES": "BNP Paribas Securities",
    "MUFG_CUSTODY": "MUFG Custody",
    "HSBC_KOREA": "HSBC Korea",
    "ABN_AMRO_CUSTODY": "ABN AMRO Custody",
    "CITI_AUSTRALIA": "Citigroup Australia",
    "RBC_INVESTOR_SERVICES": "RBC Investor Services",
    "STATE_STREET_BOSTON": "State Street Boston",
    "CITI_LONDON": "Citigroup London",
    "GOLDMAN_SACHS": "Goldman Sachs",
    "SEB_CUSTODY": "SEB Custody",
    "DANSKE_BANK_CUSTODY": "Danske Bank Custody",
    "NORDEA_CUSTODY": "Nordea Custody",
    "MORGAN_STANLEY": "Morgan Stanley",
}

DISPLAY_TO_CODE = {v: k for k, v in CUSTODIAN_CODE_TO_DISPLAY.items()}


def _normalize_custodian(custodian: str) -> str:
    """Map display name to code, or return uppercased/cleaned version."""
    if custodian in DISPLAY_TO_CODE:
        return DISPLAY_TO_CODE[custodian]
    return custodian.upper().replace(" ", "_")


def evaluate_errand(errand: dict) -> dict:
    """
    Evaluate if an errand is worth pursuing (recoverable money).
    Returns: { worth_it: bool, recoverable_amount: float, reason: str,
               action_type: str, suggested_actions: list[str], currency: str }
    """
    payments = errand.get("payments") or []
    if not payments:
        return {
            "worth_it": False,
            "recoverable_amount": 0.0,
            "reason": "No payments in errand",
            "action_type": "",
            "suggested_actions": [],
            "suggested_references": [],
            "currency": "USD",
        }

    expected_list = load_expected_payments()
    custodian_norm = _normalize_custodian(errand.get("custodian", ""))
    account = errand.get("account", "")

    expected_by_key: dict[str, tuple] = {}
    for exp in expected_list:
        if exp.expected_status.value == "NO_DIVIDEND":
            continue
        key = (exp.custodian, exp.account_number, exp.isin)
        expected_by_key[key] = exp

    total_recoverable = 0.0
    action_type = ""
    suggested_actions: list[str] = []
    currency = "USD"
    matched_pay: dict | None = None
    matched_exp = None

    for pay in payments:
        isin = pay.get("isin")
        if not isin:
            continue
        received_net = pay.get("net") or 0.0
        received_tax = pay.get("tax") or 0.0
        curr = pay.get("currency") or "USD"
        currency = curr

        exp = expected_by_key.get((custodian_norm, account, isin))
        if not exp:
            continue

        exp_net = exp.expected_net_amount
        exp_tax = exp.expected_tax
        diff = received_net - exp_net

        if abs(diff) <= WORTHINESS_THRESHOLD:
            continue

        if diff < 0:
            recoverable = abs(diff)
            if abs(received_tax - exp_tax) > 0.01:
                action_type = "tax_reclaim"
            else:
                action_type = "missing_followup"
        else:
            recoverable = diff
            action_type = "overpayment_return"

        matched_pay = pay
        matched_exp = exp
        total_recoverable += recoverable

    suggested_references: list[dict[str, str]] = []
    if total_recoverable > 0 and matched_pay is not None and matched_exp is not None:
        try:
            from services.anthropic_client import generate_action_steps

            suggested_actions, suggested_references = generate_action_steps(
                errand=errand,
                pay=matched_pay,
                exp=matched_exp,
                action_type=action_type,
                recoverable_amount=total_recoverable,
                currency=currency,
            )
        except Exception as e:
            logger.warning("AI action steps failed, using fallback: %s", e)
            suggested_actions = FALLBACK_STEPS.get(action_type, FALLBACK_STEPS["tax_reclaim"])

    if total_recoverable <= 0:
        return {
            "worth_it": False,
            "recoverable_amount": 0.0,
            "reason": "No recoverable discrepancy above threshold",
            "action_type": "",
            "suggested_actions": [],
            "suggested_references": [],
            "currency": currency,
        }

    return {
        "worth_it": True,
        "recoverable_amount": round(total_recoverable, 2),
        "reason": f"Discrepancy of {currency} {total_recoverable:,.2f} recoverable",
        "action_type": action_type,
        "suggested_actions": suggested_actions,
        "suggested_references": suggested_references,
        "currency": currency,
    }
