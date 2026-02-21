"""Load expected and received payment data from CSV files."""

from __future__ import annotations

import csv
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

from models.schemas import (
    ExpectedPayment,
    ExpectedStatus,
    ReceivedPayment,
    SettlementStatus,
)

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "files" / "v2_data"


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _parse_datetime(value: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse datetime: {value}")


def _load_csv(filename: str) -> list[dict[str, str]]:
    path = DATA_DIR / filename
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


@lru_cache(maxsize=1)
def load_expected_payments() -> list[ExpectedPayment]:
    rows = _load_csv("expected_payments_v2.csv")
    payments: list[ExpectedPayment] = []
    for row in rows:
        payments.append(
            ExpectedPayment(
                expected_id=row["EXPECTED_ID"],
                isin=row["ISIN"],
                sedol=row["SEDOL"],
                ticker=row["TICKER"],
                company_name=row["COMPANY_NAME"],
                ex_date=_parse_date(row["EX_DATE"]),
                pay_date=_parse_date(row["PAY_DATE"]),
                holding_quantity=int(row["HOLDING_QUANTITY"]),
                div_rate=float(row["DIV_RATE"]),
                quotation_currency=row["QUOTATION_CURRENCY"],
                expected_gross_amount=float(row["EXPECTED_GROSS_AMOUNT"]),
                tax_treaty=row["TAX_TREATY"],
                tax_treaty_rate=float(row["TAX_TREATY_RATE"]),
                expected_tax=float(row["EXPECTED_TAX"]),
                expected_net_amount=float(row["EXPECTED_NET_AMOUNT"]),
                custodian=row["CUSTODIAN"],
                account_number=row["ACCOUNT_NUMBER"],
                calculation_date=_parse_date(row["CALCULATION_DATE"]),
                expected_status=ExpectedStatus(row["EXPECTED_STATUS"]),
            )
        )
    return payments


@lru_cache(maxsize=1)
def load_received_payments() -> list[ReceivedPayment]:
    rows = _load_csv("received_payments_v2.csv")
    payments: list[ReceivedPayment] = []
    for row in rows:
        payments.append(
            ReceivedPayment(
                received_id=row["RECEIVED_ID"],
                custodian_ref=row["CUSTODIAN_REF"],
                isin=row["ISIN"],
                sedol=row["SEDOL"],
                ticker=row["TICKER"],
                company_name=row["COMPANY_NAME"],
                pay_date=_parse_date(row["PAY_DATE"]),
                settlement_date=_parse_date(row["SETTLEMENT_DATE"]),
                received_gross_amount=float(row["RECEIVED_GROSS_AMOUNT"]),
                tax_withheld=float(row["TAX_WITHHELD"]),
                received_net_amount=float(row["RECEIVED_NET_AMOUNT"]),
                settlement_currency=row["SETTLEMENT_CURRENCY"],
                custodian=row["CUSTODIAN"],
                account_number=row["ACCOUNT_NUMBER"],
                received_timestamp=_parse_datetime(row["RECEIVED_TIMESTAMP"]),
                settlement_status=SettlementStatus(row["SETTLEMENT_STATUS"]),
                notes=row.get("NOTES") or None,
            )
        )
    return payments
