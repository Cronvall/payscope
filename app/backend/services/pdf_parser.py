"""Extract structured payment data from custodian PDF statements via Claude."""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from pathlib import Path

import anthropic

from models.schemas import ExtractedPayment, PDFExtraction, PDFListItem

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
PDF_DIR = Path(__file__).resolve().parent.parent.parent.parent / "public" / "pdfs"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


EXTRACTION_SYSTEM_PROMPT = """\
You are a financial document data extraction agent. You will receive a custodian \
dividend payment statement in PDF form.

Extract ALL payment records from the document into structured JSON.

Respond ONLY with valid JSON matching this exact schema (no markdown fences):
{
  "custodian": "name of the custodian bank",
  "account": "account number if visible",
  "date": "statement date in YYYY-MM-DD format",
  "payments": [
    {
      "company": "company name",
      "isin": "ISIN code if present",
      "ticker": "ticker symbol if present",
      "shares": 12345,
      "rate": 0.25,
      "gross": 375000.00,
      "tax": 93750.00,
      "net": 281250.00,
      "currency": "USD"
    }
  ]
}

Rules:
- Extract every payment row you can find.
- Use null for any field you cannot determine.
- Numbers should be plain floats, no formatting.
- If the document is in a non-English language, still extract the data and translate field names to English.
"""


def list_pdfs() -> list[PDFListItem]:
    if not PDF_DIR.exists():
        return []
    items: list[PDFListItem] = []
    for p in sorted(PDF_DIR.glob("*.pdf")):
        custodian_hint = p.stem.rsplit("_", 1)[0].replace("_", " ").title()
        items.append(
            PDFListItem(
                filename=p.name,
                size_bytes=p.stat().st_size,
                custodian_hint=custodian_hint,
            )
        )
    return items


def _read_extraction_cache(filename: str) -> PDFExtraction | None:
    path = CACHE_DIR / f"pdf_{filename}.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return PDFExtraction(**json.load(f))
    return None


def _write_extraction_cache(filename: str, extraction: PDFExtraction) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"pdf_{filename}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(extraction.model_dump(), f, indent=2, default=str)


async def extract_pdf(filename: str) -> PDFExtraction:
    cached = _read_extraction_cache(filename)
    if cached:
        logger.info("Cache hit for PDF extraction: %s", filename)
        return cached

    pdf_path = PDF_DIR / filename
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {filename}")

    pdf_bytes = pdf_path.read_bytes()
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    client = _get_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=EXTRACTION_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extract all payment data from this custodian statement.",
                    },
                ],
            }
        ],
    )

    raw_text = message.content[0].text
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw_text.strip())
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)

    data = json.loads(cleaned)

    extraction = PDFExtraction(
        filename=filename,
        custodian=data.get("custodian"),
        account=data.get("account"),
        date=data.get("date"),
        payments=[ExtractedPayment(**p) for p in data.get("payments", [])],
    )

    _write_extraction_cache(filename, extraction)
    logger.info("Cached PDF extraction for %s (%d payments)", filename, len(extraction.payments))

    return extraction
