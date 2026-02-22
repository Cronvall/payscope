"""Anthropic Claude API wrapper with file-based response caching."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from pathlib import Path

import anthropic

from models.schemas import AIAnalysis, Discrepancy

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
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


# ---------------------------------------------------------------------------
# Caching helpers
# ---------------------------------------------------------------------------

def _cache_key(prefix: str, content: str) -> str:
    digest = hashlib.sha256(content.encode()).hexdigest()[:16]
    return f"{prefix}_{digest}"


def _read_cache(key: str) -> dict | None:
    path = CACHE_DIR / f"{key}.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return None


def _write_cache(key: str, data: dict) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{key}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


# ---------------------------------------------------------------------------
# Discrepancy analysis
# ---------------------------------------------------------------------------

ANALYSIS_SYSTEM_PROMPT = """\
You are an AI financial reconciliation agent analyzing dividend payment discrepancies.

Your task:
1. Verify the calculation logic step by step
2. Compare expected vs received amounts
3. Identify the root cause of the discrepancy
4. Provide a clear, actionable explanation

Respond ONLY with valid JSON matching this exact schema (no markdown fences):
{
  "verification_steps": ["step 1", "step 2", ...],
  "root_cause": "one clear sentence",
  "explanation": "2-3 sentences explaining what happened",
  "recommendation": "recovery action, timeline, required documentation",
  "recoverable_amount": 12345.00,
  "timeline": "15-30 days"
}
"""


def _build_analysis_user_prompt(disc: Discrepancy) -> str:
    exp = disc.expected
    parts = [
        f"Security: {exp.company_name} ({exp.ticker})",
        f"ISIN: {exp.isin}",
        f"Holdings: {exp.holding_quantity:,} shares",
        f"Dividend Rate: {exp.div_rate} {exp.quotation_currency}/share",
        f"Expected Gross: {exp.quotation_currency} {exp.expected_gross_amount:,.2f}",
        f"Tax Treaty: {exp.tax_treaty}, {exp.tax_treaty_rate}%",
        f"Expected Tax: {exp.quotation_currency} {exp.expected_tax:,.2f}",
        f"Expected Net: {exp.quotation_currency} {exp.expected_net_amount:,.2f}",
    ]

    if disc.received:
        rec = disc.received
        parts += [
            "",
            "Actual Received:",
            f"Gross: {rec.settlement_currency} {rec.received_gross_amount:,.2f}",
            f"Tax Withheld: {rec.settlement_currency} {rec.tax_withheld:,.2f}",
            f"Net: {rec.settlement_currency} {rec.received_net_amount:,.2f}",
        ]
    else:
        parts += [
            "",
            "Actual Received: NOTHING — payment not found in custodian records.",
            f"Payment Date: {exp.pay_date}",
            f"Custodian: {exp.custodian}",
        ]

    parts += [
        "",
        f"Discrepancy Type: {disc.type.value}",
        f"Discrepancy Amount: {disc.discrepancy_amount:,.2f}",
        "",
        "Analyze this discrepancy step by step.",
    ]

    return "\n".join(parts)


async def analyze_discrepancy(disc: Discrepancy) -> AIAnalysis:
    user_prompt = _build_analysis_user_prompt(disc)
    cache_key = _cache_key("analysis", user_prompt)

    cached = _read_cache(cache_key)
    if cached:
        logger.info("Cache hit for analysis %s", disc.id)
        return AIAnalysis(**cached)

    client = _get_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=ANALYSIS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_text = message.content[0].text
    # Strip markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw_text.strip())
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)

    data = json.loads(cleaned)
    analysis = AIAnalysis(**data)

    _write_cache(cache_key, analysis.model_dump())
    logger.info("Cached analysis for %s", disc.id)

    return analysis


# ---------------------------------------------------------------------------
# Action steps (concise, AI-generated) with authoritative source references
# ---------------------------------------------------------------------------

# Official government and treaty organization sources for strengthening tax claims.
# Curated from tax_treaty_sources.md – government and treaty-body URLs for WHT rates and reclaim procedures.
TREATY_SOURCES: dict[str, list[dict[str, str]]] = {
    "general": [
        {"title": "OECD – Tax Treaties Topic Page", "url": "https://www.oecd.org/en/topics/tax-treaties.html"},
        {"title": "OECD – WHT Rates & Tax Treaties (Corporate Tax Statistics 2025)", "url": "https://www.oecd.org/en/publications/corporate-tax-statistics-2025_6a915941-en/full-report/withholding-tax-rates-and-tax-treaties_e2216eab.html"},
        {"title": "Tax Treaties Explorer (ICTD/World Bank)", "url": "https://www.treaties.tax/"},
        {"title": "European Commission – Double Taxation Conventions", "url": "https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/double-taxations-conventions_en"},
        {"title": "Nordisk eTax – Joint Nordic Tax Authority Portal", "url": "https://nordisketax.net/"},
    ],
    # US–UK
    "US-UK": [
        {"title": "US Treasury – Treaties & Related Documents", "url": "https://home.treasury.gov/policy-issues/tax-policy/treaties"},
        {"title": "IRS – UK Tax Treaty Documents", "url": "https://www.irs.gov/businesses/international-businesses/united-kingdom-uk-tax-treaty-documents"},
        {"title": "IRS – Tax Treaty Tables (dividend/interest/royalty rates)", "url": "https://www.irs.gov/individuals/international-taxpayers/tax-treaty-tables"},
        {"title": "GOV.UK – USA Tax Treaties", "url": "https://www.gov.uk/government/publications/usa-tax-treaties"},
        {"title": "GOV.UK – UK/USA Convention Full Text (PDF)", "url": "https://assets.publishing.service.gov.uk/media/5a81972ce5274a2e8ab54ce7/usa-consolidated_-_in_force.pdf"},
    ],
    # US–Sweden
    "US-SE": [
        {"title": "IRS – Sweden Tax Treaty Documents", "url": "https://www.irs.gov/businesses/international-businesses/sweden-tax-treaty-documents"},
        {"title": "US State Dept – US–Sweden Convention Full Text (PDF)", "url": "https://www.state.gov/wp-content/uploads/2019/02/06-831-Sweden-Taxation-Conventn-and-Amend.pdf"},
        {"title": "Skatteverket – Swedish WHT on Dividends (refund, relief-at-source)", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
        {"title": "Skatteverket – Rättslig Vägledning: Skatteavtal A–Z", "url": "https://www4.skatteverket.se/rattsligvagledning/edition/2025.2/445184.html"},
    ],
    # Canada–Norway
    "CA-NO": [
        {"title": "CRA – Tax Treaties", "url": "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/international-tax/tax-treaties.html"},
        {"title": "CRA – Rates for Part XIII Tax (WHT rates & treaty reduction)", "url": "https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/payments-non-residents/nr4-part-xiii-tax/part-xiii-withholding-tax/rates-part-xiii-tax.html"},
        {"title": "Skatteetaten – Reduced WHT on Dividends for Foreign Shareholders", "url": "https://www.skatteetaten.no/en/person/taxes/get-the-taxes-right/shares-and-securities/about-shares-and-securities/reduced-withholding-tax-on-dividends/"},
        {"title": "Skatteetaten – Documentation Requirements for Reduced WHT", "url": "https://www.skatteetaten.no/en/business-and-organisation/start-and-run/best-practices-accounting-and-cash-register-systems/salary-loans-and-dividend/dividends-from-norwegian-companies-to-foreign-shareholders---documentation-requirements-for-reduced-withholding-tax-rate/"},
    ],
    # Germany–Norway
    "DE-NO": [
        {"title": "BZSt – Withholding Tax Relief (exemption & refund procedures)", "url": "https://www.bzst.de/EN/Businesses/Withholding_taxes/Withholding_Tax_Relief/withholding_tax_relief_node.html"},
        {"title": "BZSt – Capital Yield Tax Relief / Refund Procedures", "url": "https://www.bzst.de/EN/Businesses/Capital_Yield_Tax_Relief/electronic_filing_procedure/refund_procedure_investment_section32_6_kstg/refund_procedure_section32_6_kstg_node.html"},
        {"title": "BMF – Tax Treaties", "url": "https://www.bundesfinanzministerium.de/Web/EN/Issues/Taxation/Tax_Policy/tax_treaties.html"},
        {"title": "Skatteetaten – Double Taxation", "url": "https://www.skatteetaten.no/en/person/taxes/get-the-taxes-right/abroad/double-taxation/"},
    ],
    # Germany–Sweden
    "DE-SE": [
        {"title": "BZSt – Withholding Tax Relief", "url": "https://www.bzst.de/EN/Businesses/Withholding_taxes/Withholding_Tax_Relief/withholding_tax_relief_node.html"},
        {"title": "Skatteverket – Rättslig Vägledning: Skatteavtal A–Z", "url": "https://www4.skatteverket.se/rattsligvagledning/edition/2025.2/445184.html"},
        {"title": "Skatteverket – Swedish WHT on Dividends", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
    ],
    # Denmark–Norway / Denmark–Sweden (Nordic)
    "DK-NO": [
        {"title": "Skat.dk – Claiming Refund of Danish Dividend Tax", "url": "https://skat.dk/en-us/businesses/companies-and-foundations/companies-and-foundations/declaring-and-paying-dividends-and-dividend-tax/claiming-refund-of-danish-dividend-tax"},
        {"title": "Skat.dk – Online Claim Form for Dividend Tax Refund", "url": "https://skat.dk/en-us/help/forms/06-tax-dividends-royalties-and-withholding-tax-on-interest-payments/claim-refund-of-danish-dividend-tax"},
        {"title": "Skatteetaten – Nordic Tax Withholding Agreement", "url": "https://www.skatteetaten.no/en/business-and-organisation/foreign/employer/nordic-tax-withholding-agreement/"},
    ],
    "DK-SE": [
        {"title": "Skat.dk – Claiming Refund of Danish Dividend Tax", "url": "https://skat.dk/en-us/businesses/companies-and-foundations/companies-and-foundations/declaring-and-paying-dividends-and-dividend-tax/claiming-refund-of-danish-dividend-tax"},
        {"title": "Nordisk eTax – Nordic portal", "url": "https://nordisketax.net/"},
        {"title": "Skatteverket – Swedish WHT on Dividends", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
    ],
    # Finland–Norway / Finland–Sweden
    "FI-NO": [
        {"title": "Vero – Tax Treaties", "url": "https://www.vero.fi/en/companies-and-associations/international-taxation/tax-treaties/"},
        {"title": "Vero – Payments of Dividends to Nonresidents", "url": "https://www.vero.fi/en/detailed-guidance/guidance/49133/payments-of-dividends-interest-and-royalties-to-nonresidents3/"},
        {"title": "Vero – Refund Application (Form 6163e + 6167e for corps, 6164e for individuals)", "url": "https://www.vero.fi/en/About-us/contact-us/forms/descriptions/application_for_refund_of_finnish_withh/"},
        {"title": "Skatteetaten – Nordic Tax Withholding Agreement", "url": "https://www.skatteetaten.no/en/business-and-organisation/foreign/employer/nordic-tax-withholding-agreement/"},
    ],
    "FI-SE": [
        {"title": "Vero – Tax Treaties", "url": "https://www.vero.fi/en/companies-and-associations/international-taxation/tax-treaties/"},
        {"title": "Nordisk eTax – Own Shares in Sweden (Nordic residents)", "url": "https://nordisketax.net/pages/en-GB/ownin/sweden/shares/"},
        {"title": "Skatteverket – Rättslig Vägledning: Skatteavtal A–Z", "url": "https://www4.skatteverket.se/rattsligvagledning/edition/2025.2/445184.html"},
    ],
    # France–Norway / France–Sweden
    "FR-NO": [
        {"title": "impots.gouv.fr – Dividends (Non-Resident Information)", "url": "https://www.impots.gouv.fr/international-particulier/dividends"},
        {"title": "impots.gouv.fr – Form 5001 (Reimbursement of WHT on Dividends)", "url": "https://www.impots.gouv.fr/sites/default/files/formulaires/5001-sd/2024/5001-sd_4529.pdf"},
        {"title": "Skatteetaten – Double Taxation", "url": "https://www.skatteetaten.no/en/person/taxes/get-the-taxes-right/abroad/double-taxation/"},
    ],
    "FR-SE": [
        {"title": "impots.gouv.fr – Dividends (Non-Resident Information)", "url": "https://www.impots.gouv.fr/international-particulier/dividends"},
        {"title": "Skatteverket – Swedish WHT on Dividends", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
    ],
    # Japan–Norway / Japan–Sweden
    "JP-NO": [
        {"title": "NTA – Tax Treaties", "url": "https://www.nta.go.jp/english/tax_system/treaty.htm"},
        {"title": "NTA – Application Forms for Income Tax Convention (Form 1 for dividends)", "url": "https://www.nta.go.jp/english/taxes/withholing/tax_convention.htm"},
        {"title": "NTA – Refund of Overpaid Withholding Tax (Form 11)", "url": "https://www.nta.go.jp/english/taxes/withholing/Information/13002.htm"},
        {"title": "Skatteetaten – Documentation for Reduced WHT", "url": "https://www.skatteetaten.no/en/business-and-organisation/start-and-run/best-practices-accounting-and-cash-register-systems/salary-loans-and-dividend/dividends-from-norwegian-companies-to-foreign-shareholders---documentation-requirements-for-reduced-withholding-tax-rate/"},
    ],
    "JP-SE": [
        {"title": "NTA – Tax Treaties", "url": "https://www.nta.go.jp/english/tax_system/treaty.htm"},
        {"title": "NTA – Application Forms for Income Tax Convention", "url": "https://www.nta.go.jp/english/taxes/withholing/tax_convention.htm"},
        {"title": "Skatteverket – Swedish WHT on Dividends", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
    ],
    # Australia–Norway / Australia–Sweden
    "AU-NO": [
        {"title": "ATO – Tax Treaties Overview", "url": "https://www.ato.gov.au/about-ato/international-tax-agreements/in-detail/what-are-tax-treaties"},
        {"title": "ATO – Withholding from Dividends Paid to Foreign Residents", "url": "https://www.ato.gov.au/businesses-and-organisations/international-tax-for-business/in-detail/income/withholding-from-dividends-paid-to-foreign-residents"},
        {"title": "AU Treasury – Income Tax Treaties Table", "url": "https://treasury.gov.au/tax-treaties/income-tax-treaties"},
        {"title": "Skatteetaten – Reduced WHT on Dividends", "url": "https://www.skatteetaten.no/en/person/taxes/get-the-taxes-right/shares-and-securities/about-shares-and-securities/reduced-withholding-tax-on-dividends/"},
    ],
    "AU-SE": [
        {"title": "ATO – Tax Treaties Overview", "url": "https://www.ato.gov.au/about-ato/international-tax-agreements/in-detail/what-are-tax-treaties"},
        {"title": "AU Treasury – Income Tax Treaties Table", "url": "https://treasury.gov.au/tax-treaties/income-tax-treaties"},
        {"title": "Skatteverket – Swedish WHT on Dividends", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
    ],
    # Netherlands–Norway / Netherlands–Sweden
    "NL-NO": [
        {"title": "Belastingdienst – Recipient of Dividend Outside Netherlands – Refund", "url": "https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/dividend-tax/dividend-payment/recipient-of-dividend-outside-the-netherlands-dividend-tax-refund/"},
        {"title": "Belastingdienst – Dividend Tax Refund Procedure", "url": "https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/dividend-tax/dividend-payment/recipient-of-dividend-outside-the-netherlands-dividend-tax-refund/recipient-of-portfolio-dividend-outside-the-netherlands-dividend-tax-refund/recipient-of-dividend-outside-the-netherlands-dividend-tax-refund-procedure/recipient-of-dividend-outside-the-netherlands-dividend-tax-refund-procedure"},
        {"title": "Belastingdienst – IB 92 Universeel Form (treaty relief)", "url": "https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/themaoverstijgend/applications_and_forms/application_for_a_partial_exemption_from_or_refund_of_dutch_dividend_tax_universal"},
        {"title": "Skatteetaten – Double Taxation", "url": "https://www.skatteetaten.no/en/person/taxes/get-the-taxes-right/abroad/double-taxation/"},
    ],
    "NL-SE": [
        {"title": "Belastingdienst – Recipient of Dividend Outside Netherlands – Refund", "url": "https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/dividend-tax/dividend-payment/recipient-of-dividend-outside-the-netherlands-dividend-tax-refund/"},
        {"title": "Business.gov.nl – WHT Exemption or Refund", "url": "https://business.gov.nl/regulations/withholding-tax-exemption-refund/"},
        {"title": "Skatteverket – Swedish WHT on Dividends", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
    ],
    # Sweden–Norway (Nordic pair)
    "SE-NO": [
        {"title": "Nordisk eTax – Own Shares in Sweden (Nordic residents)", "url": "https://nordisketax.net/pages/en-GB/ownin/sweden/shares/"},
        {"title": "Grensetjänsten Norge–Sverige – Tax Treaty & NT1/NT2 Forms", "url": "https://www.grensetjansten.com/sv/foretag/skatt-och-avgifter/skatteavtal-mot-dubbelbeskattning-och-intygen-nt1-och-nt2"},
        {"title": "Skatteetaten – Nordic Tax Withholding Agreement", "url": "https://www.skatteetaten.no/en/business-and-organisation/foreign/employer/nordic-tax-withholding-agreement/"},
        {"title": "Skatteverket – Rättslig Vägledning: Skatteavtal A–Z", "url": "https://www4.skatteverket.se/rattsligvagledning/edition/2025.2/445184.html"},
    ],
    "NO-SE": [
        {"title": "Nordisk eTax – Own Shares in Sweden", "url": "https://nordisketax.net/pages/en-GB/ownin/sweden/shares/"},
        {"title": "Skatteverket – Swedish WHT on Dividends", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
        {"title": "Skatteverket – SKV 3740 – Claim for Repayment of Swedish Tax on Dividends", "url": "https://skatteverket.se/privat/etjansterochblanketter/blanketterbroschyrer/blanketter/info/3740.4.14c8822103ed36869780003844.html"},
    ],
    # UK–Sweden
    "UK-SE": [
        {"title": "GOV.UK – Sweden Tax Treaties", "url": "https://www.gov.uk/government/publications/sweden-tax-treaties"},
        {"title": "Skatteverket – Swedish WHT on Dividends", "url": "https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/nonestablishedforeignbusinesses/swedishwithholdingtaxondividends.4.34a801ea1041d54f9e28000452.html"},
        {"title": "Skatteverket – Rättslig Vägledning: Skatteavtal A–Z", "url": "https://www4.skatteverket.se/rattsligvagledning/edition/2025.2/445184.html"},
    ],
}

ACTION_STEPS_SYSTEM_PROMPT = """\
You are a dividend reconciliation expert. Given full context about a custodian payment discrepancy, output 2–4 concise next steps to recover the money AND authoritative references that strengthen the claim.

Be specific to this case: reference the custodian, security, tax treaty, or amount where relevant.
Keep each step short (one line).
When the discrepancy involves tax treaty rates, ALWAYS include relevant government or treaty organization references from the provided list to support why the lower rate applies.

Output ONLY valid JSON in this exact format (no markdown fences):
{
  "steps": ["step 1", "step 2", ...],
  "references": [{"title": "Short source title", "url": "https://..."}, ...]
}

Use 1–3 references from the provided source list that best support this specific treaty/country. If unsure, include the general OECD and Norwegian Tax Administration links.
"""

ACTION_STEPS_MAX_TOKENS = 350


def _get_relevant_sources(tax_treaty: str) -> list[dict[str, str]]:
    """Get authoritative sources for the given tax treaty code."""
    treaty_key = (tax_treaty or "").strip().upper().replace(" ", "-")
    sources = TREATY_SOURCES.get(treaty_key, TREATY_SOURCES["general"])
    return sources.copy()


def generate_action_steps(
    errand: dict,
    pay: dict,
    exp,  # ExpectedPayment
    action_type: str,
    recoverable_amount: float,
    currency: str,
) -> tuple[list[str], list[dict[str, str]]]:
    """
    Generate concise, case-specific next steps using AI, with authoritative
    government/treaty references that strengthen claims on tax rates.
    Returns (steps, references).
    """
    sources = _get_relevant_sources(exp.tax_treaty)
    sources_text = "\n".join(
        f"  - {s['title']}: {s['url']}" for s in sources
    )

    context = [
        "Errand:",
        f"  Client: {errand.get('client_id', '')}",
        f"  Custodian: {errand.get('custodian', '')}",
        f"  Account: {errand.get('account', '')}",
        "",
        "Expected (from holdings):",
        f"  Security: {exp.company_name} ({exp.ticker}) ISIN {exp.isin}",
        f"  Holdings: {exp.holding_quantity:,} shares, rate {exp.div_rate} {exp.quotation_currency}/share",
        f"  Tax treaty: {exp.tax_treaty} ({exp.tax_treaty_rate}%)",
        f"  Expected net: {exp.quotation_currency} {exp.expected_net_amount:,.2f}",
        "",
        "Received (from custodian statement):",
        f"  Gross: {pay.get('gross')}, Tax: {pay.get('tax')}, Net: {pay.get('net')} {pay.get('currency', '')}",
        "",
        f"Discrepancy type: {action_type}",
        f"Recoverable: {currency} {recoverable_amount:,.2f}",
        "",
        "Authoritative sources you MAY cite (use title + url exactly):",
        sources_text,
        "",
        "Output JSON with 'steps' (2-4 items) and 'references' (1-3 items from above).",
    ]
    user_prompt = "\n".join(context)
    cache_key = _cache_key("action_steps", user_prompt)

    def _is_valid_task(s: str) -> bool:
        """Temp fix: JSON fragments can't be valid task steps (e.g. {"steps": [)."""
        t = s.strip()
        if not t:
            return False
        if t.startswith("{") or t.startswith("["):
            return False
        if '"steps"' in t or "'steps'" in t:
            return False
        return True

    cached = _read_cache(cache_key)
    if cached and isinstance(cached.get("steps"), list):
        logger.info("Cache hit for action steps")
        refs = cached.get("references") or []
        if not refs:
            refs = _get_relevant_sources(exp.tax_treaty)[:3]
        steps_from_cache = [s for s in cached["steps"] if isinstance(s, str) and _is_valid_task(s)]
        return steps_from_cache, refs

    client = _get_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=ACTION_STEPS_MAX_TOKENS,
        system=ACTION_STEPS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = message.content[0].text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    steps: list[str] = []
    references: list[dict[str, str]] = []

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            steps = data.get("steps") or []
            references = data.get("references") or []
            # Validate reference shape
            refs_valid = [
                {"title": r.get("title", ""), "url": r.get("url", "")}
                for r in references
                if isinstance(r, dict) and r.get("url")
            ]
            references = refs_valid[:5]
        else:
            steps = data if isinstance(data, list) else [str(data)]
    except json.JSONDecodeError:
        steps = [
            line.strip()
            for line in raw.split("\n")
            if line.strip() and not line.strip().startswith("```")
        ]

    if not isinstance(steps, list):
        steps = [str(steps)]
    steps = [s if isinstance(s, str) else str(s) for s in steps][:6]
    steps = [s for s in steps if _is_valid_task(s)]

    # Fallback: if AI didn't return references, attach relevant sources
    if not references and sources:
        references = sources[:3]

    _write_cache(cache_key, {"steps": steps, "references": references})
    return steps, references
