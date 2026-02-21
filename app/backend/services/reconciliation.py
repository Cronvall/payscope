"""Reconciliation engine: compare expected vs received payments and detect discrepancies."""

from __future__ import annotations

from datetime import datetime, timezone

from models.schemas import (
    Discrepancy,
    DiscrepancyType,
    ExpectedPayment,
    ExpectedStatus,
    ReceivedPayment,
    ReconciliationResult,
    ReconciliationSummary,
    Severity,
)


def _classify_severity(amount: float) -> Severity:
    abs_amount = abs(amount)
    if abs_amount > 100_000:
        return Severity.CRITICAL
    if abs_amount > 10_000:
        return Severity.HIGH
    if abs_amount > 1_000:
        return Severity.MEDIUM
    return Severity.LOW


def reconcile(
    expected: list[ExpectedPayment],
    received: list[ReceivedPayment],
) -> ReconciliationResult:
    received_by_isin: dict[str, list[ReceivedPayment]] = {}
    for rec in received:
        received_by_isin.setdefault(rec.isin, []).append(rec)

    discrepancies: list[Discrepancy] = []
    matched: list[ExpectedPayment] = []
    disc_counter = 0
    now = datetime.now(timezone.utc)

    for exp in expected:
        if exp.expected_status == ExpectedStatus.NO_DIVIDEND:
            matched.append(exp)
            continue

        candidates = received_by_isin.get(exp.isin, [])
        # Pick the best match: same custodian + account, else any by ISIN
        rec = None
        for c in candidates:
            if c.custodian == exp.custodian and c.account_number == exp.account_number:
                rec = c
                break
        if rec is None and candidates:
            rec = candidates[0]

        if rec is None:
            disc_counter += 1
            discrepancies.append(
                Discrepancy(
                    id=f"DISC-{disc_counter:03d}",
                    type=DiscrepancyType.MISSING_PAYMENT,
                    severity=Severity.CRITICAL,
                    expected=exp,
                    received=None,
                    discrepancy_amount=exp.expected_net_amount,
                    detected_at=now,
                )
            )
            continue

        net_diff = rec.received_net_amount - exp.expected_net_amount
        abs_diff = abs(net_diff)

        if abs_diff <= 0.01:
            matched.append(exp)
            continue

        tax_diff = abs(rec.tax_withheld - exp.expected_tax)
        if net_diff > 0:
            disc_type = DiscrepancyType.OVERPAYMENT
        elif tax_diff > 0.01:
            disc_type = DiscrepancyType.TAX_ERROR
        else:
            disc_type = DiscrepancyType.AMOUNT_MISMATCH

        disc_counter += 1
        discrepancies.append(
            Discrepancy(
                id=f"DISC-{disc_counter:03d}",
                type=disc_type,
                severity=_classify_severity(net_diff)
                if disc_type != DiscrepancyType.MISSING_PAYMENT
                else Severity.CRITICAL,
                expected=exp,
                received=rec,
                discrepancy_amount=abs_diff,
                detected_at=now,
            )
        )

    value_at_risk = sum(d.discrepancy_amount for d in discrepancies)

    summary = ReconciliationSummary(
        total_expected=len(expected),
        total_received=len(received),
        total_matched=len(matched),
        total_discrepancies=len(discrepancies),
        value_at_risk=round(value_at_risk, 2),
    )

    return ReconciliationResult(
        discrepancies=discrepancies,
        matched=matched,
        summary=summary,
    )
