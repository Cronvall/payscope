"""Agentic PDF form filling service."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from db.case_repository import get_case
from services.data_loader import load_expected_payments
from services.worthiness import _normalize_custodian

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
TEMPLATES_DIR = PROJECT_ROOT / "files" / "form_templates"
MAPPINGS_DIR = TEMPLATES_DIR / "field_mappings"
ERANDS_PATH = PROJECT_ROOT / "files" / "dividend_season" / "errands.json"
PROFILES_PATH = PROJECT_ROOT / "files" / "client_profiles" / "profiles.json"


def _load_registry() -> dict:
    path = TEMPLATES_DIR / "registry.json"
    if not path.exists():
        return {"forms": [], "step_patterns": {}}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def list_available_forms() -> list[dict[str, str]]:
    """Return list of {key, display_name} for available forms."""
    registry = _load_registry()
    forms = []
    for f in registry.get("forms", []):
        template_path = TEMPLATES_DIR / f["filename"]
        if template_path.exists():
            forms.append({"key": f["key"], "display_name": f["display_name"]})
    return forms


def suggest_form_for_step(step: str) -> str | None:
    """Map step text to form_key using registry patterns."""
    registry = _load_registry()
    patterns = registry.get("step_patterns", {})
    step_upper = step.upper()
    for pattern, form_key in patterns.items():
        if pattern.upper() in step_upper:
            return form_key
    return None


def _load_profiles() -> dict:
    """Load client profiles from profiles.json."""
    if not PROFILES_PATH.exists():
        return {}
    with open(PROFILES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("profiles", {})


def _load_profile(client_id: str) -> dict | None:
    """Load profile for a client. Returns None if not found."""
    profiles = _load_profiles()
    return profiles.get(client_id)


def _merge_profile_into_context(ctx: dict, profile: dict) -> None:
    """Merge profile-derived fields into context for form filling."""
    if not profile:
        return
    addr = profile.get("address") or {}
    contact = profile.get("contact") or {}
    bank = profile.get("bank") or {}
    signatory = profile.get("authorized_signatory") or {}

    ctx["legal_name"] = profile.get("legal_name", "")
    ctx["display_name"] = profile.get("display_name", profile.get("legal_name", ""))
    if profile.get("legal_name"):
        ctx["client_id"] = profile["legal_name"]
    ctx["country_of_incorporation"] = ctx.get("country_of_incorporation") or profile.get("country_of_incorporation", "")
    ctx["country_of_residence"] = ctx.get("country_of_residence") or profile.get("country_of_residence", "")

    ctx["address_street"] = addr.get("street", "")
    ctx["address_postal_code"] = addr.get("postal_code", "")
    ctx["address_city"] = addr.get("city", "")
    ctx["address_country"] = addr.get("country", "")
    ctx["address_full"] = ", ".join(
        filter(None, [addr.get("street"), addr.get("postal_code"), addr.get("city"), addr.get("country")])
    )

    ctx["tax_id"] = profile.get("tax_id", "")
    ctx["ftin"] = profile.get("ftin", profile.get("tax_id", ""))

    ctx["phone"] = contact.get("phone", "")
    ctx["email"] = contact.get("email", "")

    ctx["iban"] = bank.get("iban", "")
    ctx["bic"] = bank.get("bic", "")
    ctx["bank_name"] = bank.get("bank_name", "")
    ctx["account_holder"] = bank.get("account_holder", "")
    ctx["bank_city"] = bank.get("bank_city", "")
    ctx["bank_country"] = bank.get("bank_country", "")

    ctx["signatory_name"] = signatory.get("name", "")
    ctx["signatory_initials"] = signatory.get("initials", "")
    ctx["signatory_dob"] = signatory.get("date_of_birth", "")
    ctx["signatory_title"] = signatory.get("title", "")


def _load_errand(errand_id: str) -> dict | None:
    if not ERANDS_PATH.exists():
        return None
    with open(ERANDS_PATH, encoding="utf-8") as f:
        errands = json.load(f)
    for e in errands:
        if e.get("errand_id") == errand_id:
            return e
    return None


def _resolve_expected(case: "Case", errand: dict | None) -> "ExpectedPayment | None":
    """Resolve matched expected payment for the case's errand."""
    if not errand:
        return None
    from models.schemas import ExpectedPayment

    payments = errand.get("payments") or []
    if not payments:
        return None

    try:
        expected_list = load_expected_payments()
    except Exception:
        return None

    custodian_norm = _normalize_custodian(errand.get("custodian", ""))
    account = errand.get("account", "")

    expected_by_key: dict[tuple, ExpectedPayment] = {}
    for exp in expected_list:
        if exp.expected_status.value == "NO_DIVIDEND":
            continue
        key = (exp.custodian, exp.account_number, exp.isin)
        expected_by_key[key] = exp

    for pay in payments:
        isin = pay.get("isin")
        if not isin:
            continue
        exp = expected_by_key.get((custodian_norm, account, isin))
        if exp:
            return exp
    return None


def _build_context(case: "Case", errand: dict | None, expected: "ExpectedPayment | None") -> dict:
    """Build context dict for form field mapping."""
    amount_str = f"{case.amount_recoverable:,.2f}" if case.amount_recoverable else "0"
    ctx = {
        "client_id": case.client_id,
        "custodian": case.custodian,
        "account": errand.get("account", "") if errand else "",
        "amount_recoverable": case.amount_recoverable,
        "amount_recoverable_formatted": amount_str,
        "currency": case.currency,
        "company_name": "",
        "isin": "",
        "tax_treaty": "",
        "country_of_incorporation": "",
        "gross_amount": "",
    }
    if expected:
        ctx["company_name"] = expected.company_name
        ctx["isin"] = expected.isin
        ctx["tax_treaty"] = expected.tax_treaty or ""
        treaty = (expected.tax_treaty or "").strip().upper()
        if "-" in treaty:
            ctx["country_of_incorporation"] = treaty.split("-")[-1]
        elif treaty:
            ctx["country_of_incorporation"] = treaty
    elif errand and errand.get("payments"):
        pay = errand["payments"][0]
        ctx["company_name"] = pay.get("company", "")
        ctx["isin"] = pay.get("isin", "")
    if errand and errand.get("payments"):
        pay = errand["payments"][0]
        ctx["gross_amount"] = f"{pay.get('gross', 0):,.2f}" if pay.get("gross") else ""
    profile = _load_profile(case.client_id)
    _merge_profile_into_context(ctx, profile)
    if not ctx.get("legal_name"):
        ctx["legal_name"] = case.client_id
    return ctx


def _resolve_value(field_mapping: str, ctx: dict, computed: dict) -> str:
    """Resolve a field value from context or computed expression."""
    if field_mapping in ctx:
        val = ctx.get(field_mapping, "")
        return str(val) if val is not None else ""
    if field_mapping in computed:
        handler = computed[field_mapping]
        if handler == "tax_treaty":
            treaty = ctx.get("tax_treaty", "")
            if "-" in treaty:
                return treaty.split("-")[-1].strip()
            return treaty
        if handler == "format_amount":
            return ctx.get("amount_recoverable_formatted", "")
        if handler == "gross_from_context":
            return ctx.get("gross_amount", "")
    return ""


def _load_field_mapping(form_key: str) -> tuple[dict, dict]:
    """Load field mapping config for form. Returns (fields, computed)."""
    path = MAPPINGS_DIR / f"{form_key}.json"
    if not path.exists():
        return {}, {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return (
        data.get("fields", {}),
        data.get("computed", {}),
    )


def fill_form(case_id: str, form_key: str) -> bytes:
    """
    Fill a PDF form with case data. Returns the filled PDF bytes.
    Raises ValueError if case or form not found.
    """
    from models.schemas import Case

    case = get_case(case_id)
    if not case:
        raise ValueError(f"Case not found: {case_id}")

    registry = _load_registry()
    form_config = None
    for f in registry.get("forms", []):
        if f["key"] == form_key:
            form_config = f
            break
    if not form_config:
        raise ValueError(f"Unknown form: {form_key}")

    template_path = TEMPLATES_DIR / form_config["filename"]
    if not template_path.exists():
        raise ValueError(f"Template not found: {form_config['filename']}")

    errand = _load_errand(case.errand_id)
    expected = _resolve_expected(case, errand)
    ctx = _build_context(case, errand, expected)

    fields_config, computed = _load_field_mapping(form_key)
    if not fields_config:
        logger.warning("No field mapping for %s, filling with minimal context", form_key)

    field_values: dict[str, str] = {}
    for pdf_field_name, context_key in fields_config.items():
        val = _resolve_value(context_key, ctx, computed)
        if val:
            field_values[pdf_field_name] = val

    reader = PdfReader(str(template_path))
    writer = PdfWriter()
    writer.append(reader)

    existing_fields = reader.get_fields() or {}
    if not existing_fields:
        logger.warning("PDF %s has no AcroForm fields", form_config["filename"])

    for i, page in enumerate(writer.pages):
        page_values = {k: v for k, v in field_values.items() if k in existing_fields}
        if page_values:
            try:
                writer.update_page_form_field_values(page, page_values, auto_regenerate=False)
            except Exception as e:
                logger.warning("Error updating page %d form fields: %s", i, e)

    from io import BytesIO

    buf = BytesIO()
    writer.write(buf)
    return buf.getvalue()
