"""Orchestrating AI that parses user free text and selects which tools to invoke."""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any

import anthropic

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


class Intent(str, Enum):
    RECONCILE = "reconcile"
    ANALYZE = "analyze"
    EXTRACT_PDF = "extract_pdf"
    GENERAL = "general"


@dataclass
class OrchestratorResult:
    intent: Intent
    discrepancy_id: str | None = None
    filename: str | None = None
    general_message: str | None = None


ORCHESTRATOR_SYSTEM_PROMPT = """\
You are an AI assistant for a dividend reconciliation system (PayScope). You parse user messages and decide which action to take.

You receive the conversation history for context. Use it to resolve references like "it", "the first one", "that discrepancy", "analyze it", etc.
If the user says "analyze the first one" after a reconciliation, the first discrepancy is typically DISC-001.
If they refer to "that PDF" or "the Goldman one", infer from recent assistant messages which file they mean.

Available tools:
1. **reconcile** - Compare expected vs received dividend payments. Use when the user wants to run reconciliation, compare payments, check discrepancies, find missing payments, etc.
2. **analyze** - Get AI analysis of a specific discrepancy. Requires a discrepancy ID like DISC-001. Use when the user wants to analyze, explain, or investigate a specific discrepancy.
3. **extract_pdf** - Extract payment data from a custodian PDF statement. Requires a filename. Use when the user wants to extract, parse, or read data from a PDF.
4. **general** - For questions, greetings, or when no tool applies. Use when the user asks general questions, says hello, or asks for help.

Respond ONLY with valid JSON (no markdown fences). Schema:
{
  "intent": "reconcile" | "analyze" | "extract_pdf" | "general",
  "discrepancy_id": "DISC-001" or null,
  "filename": "example.pdf" or null,
  "general_message": "helpful response text" or null
}

Rules:
- For reconcile: set intent "reconcile", leave others null
- For analyze: set intent "analyze", set discrepancy_id (e.g. DISC-001, DISC-002), leave others null
- For extract_pdf: set intent "extract_pdf", set filename from the available list if the user refers to one, leave others null
- For general: set intent "general", set general_message with a helpful reply, leave others null
- Extract discrepancy IDs case-insensitively (DISC-1, disc-001, Disc-1 all map to the standard format)
"""


# Max conversation turns to include to stay within context limits
MAX_HISTORY_TURNS = 10


def _build_messages(
    user_message: str,
    pdf_filenames: list[str],
    history: list[dict[str, str]],
    action_context: dict | None = None,
) -> list[dict[str, str]]:
    """Build message list for Claude API with full conversation context."""
    messages: list[dict[str, str]] = []

    if history:
        recent = history[-(MAX_HISTORY_TURNS * 2) :]
        for turn in recent:
            role = turn.get("role", "user")
            if role not in ("user", "assistant"):
                continue
            content = (turn.get("content") or "")[:2000]
            messages.append({"role": role, "content": content})

    current = user_message
    if action_context:
        steps = action_context.get("steps", [])
        refs = action_context.get("references") or []
        refs_str = ", ".join(f"{r.get('title', '')}: {r.get('url', '')}" for r in refs if r.get("url"))
        ctx = (
            f"[User is viewing action {action_context.get('id', '?')} "
            f"(errand {action_context.get('errand_id', '?')}): "
            f"client {action_context.get('client_id', '')}, custodian {action_context.get('custodian', '')}, "
            f"type {action_context.get('type', '')}, "
            f"{action_context.get('amount_recoverable', 0)} {action_context.get('currency', '')} recoverable. "
            f"Steps: {steps}"
        )
        if refs_str:
            ctx += f" Official sources supporting this action: {refs_str}"
        ctx += "]\n\n"
        current = ctx + current
    if pdf_filenames:
        current += f"\n\n[Available PDFs: {', '.join(pdf_filenames)}]"
    messages.append({"role": "user", "content": current})

    return messages


def parse_intent(
    user_message: str,
    pdf_filenames: list[str],
    history: list[dict[str, str]] | None = None,
    action_context: dict | None = None,
) -> OrchestratorResult:
    """Use AI to parse user intent and extract parameters, with optional chat history."""
    client = _get_client()
    messages = _build_messages(user_message, pdf_filenames, history or [], action_context)

    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=ORCHESTRATOR_SYSTEM_PROMPT,
        messages=messages,
    )

    raw_text = response.content[0].text
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw_text.strip())
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    data = json.loads(cleaned)

    intent = Intent(data.get("intent", "general"))
    disc_id = data.get("discrepancy_id")
    filename = data.get("filename")
    general_msg = data.get("general_message")

    if disc_id:
        nums = re.sub(r"[^0-9]", "", str(disc_id))
        disc_id = f"DISC-{int(nums):03d}" if nums else None

    return OrchestratorResult(
        intent=intent,
        discrepancy_id=disc_id or None,
        filename=filename or None,
        general_message=general_msg,
    )
