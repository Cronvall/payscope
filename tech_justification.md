
  PayScope — Technical AI Pitch

  What makes our Claude usage interesting and complex

  Most applications treat a language model as a glorified chatbot — one prompt in, one answer out. PayScope uses Claude across
  three distinct, purpose-built invocations that each carry different responsibilities, constraints, and output contracts.

  1. Structured financial analysis under strict schema enforcement
  When a discrepancy is detected, Claude receives a fully materialized financial fact-sheet: holding quantity, dividend rate,
  gross/net expectations, tax treaty code and rate, custodian name, and the exact delta between expected and received. The system
  prompt mandates a specific JSON schema — verification_steps, root_cause, explanation, recommendation, recoverable_amount,
  timeline — and the code strips markdown fences and parses the response directly into a Pydantic AIAnalysis model. There is no
  tolerance for hallucinated structure; a json.loads failure surfaces immediately. This is Claude operating as a typed function,
  not a chat partner.

  2. Intent routing as an AI orchestration layer
  The /api/chat endpoint does not route requests with if/else logic. It sends the full conversation history — up to 20 turns —
  plus a structured action context object (current errand, steps, references, amounts) into a second Claude call whose only job is
   to return one of four intents: reconcile, analyze, extract_pdf, or general. The model resolves pronouns ("analyze it", "the
  Goldman one") against prior turns, normalizes free-form discrepancy references ("disc-1", "DISC001") into canonical IDs, and
  signals which tool to invoke next. The backend then dispatches programmatically on that signal. This is Claude as a router, not
  as a respondent.

  3. Context-aware, treaty-grounded action generation
  The most operationally complex call is generate_action_steps. It injects curated authoritative sources — actual government URLs
  from the IRS, Skatteverket, BZSt, Belastingdienst, NTA, ATO, and others — keyed by bilateral tax treaty code (e.g. "CA-NO",
  "JP-SE"). Claude is instructed to reference these sources by title and URL exactly, and to distinguish between a tax_reclaim
  (client is owed money, pursue recovery) and an overpayment_return (client received excess, must return it) — the framing of the
  response must flip entirely depending on the action type. The output is a JSON {steps, references} object that becomes
  actionable case guidance.

  All three call sites use SHA-256–keyed file-based caching so identical financial inputs never trigger redundant API calls, and
  Claude's responses become a stable, auditable record alongside the raw data.

  ---
  How we turn raw data into insight, predictions, and decisions

  The pipeline has four distinct transformation stages:

  Stage 1 — Raw → Structured discrepancy (deterministic)
  Two CSVs — expected_payments_v2.csv (holdings × dividend rate × treaty rate = expected net) and received_payments_v2.csv
  (custodian settlement records) — are joined by ISIN, custodian, and account number. The reconciliation engine classifies each
  mismatch into one of four types: TAX_ERROR (tax delta > £0.01), MISSING_PAYMENT (no custodian record at all), AMOUNT_MISMATCH
  (net delta without a tax component), or OVERPAYMENT (received more than entitled). Severity is tiered at £1k / £10k / £100k
  thresholds. This stage is entirely deterministic — no AI involved.

  Stage 2 — Discrepancy → Causal analysis (AI reasoning)
  Claude receives the structured discrepancy and produces a step-by-step verification: it re-derives the expected net from first
  principles, checks whether the tax withholding rate matches the treaty, identifies the root cause in one sentence, and estimates
   a recoverable amount with a recovery timeline. This turns a financial delta into an explanation of why it exists and what it is
   worth pursuing.

  Stage 3 — Errand → Worthiness decision (rule + AI hybrid)
  The worthiness.py service applies a £100 threshold filter first — this is a deliberate, cheap gate that eliminates noise before
  any AI call is made. For errands that pass, it determines action_type from the sign and tax composition of the diff, then calls
  Claude for case-specific next steps. The decision "worth pursuing?" is made by rules; the decision "how to pursue it?" is made
  by AI.

  Stage 4 — Action → Evidence-backed case file (AI + curated data)
  The generated steps are paired with official treaty references, making the output not just advisory but citable. A fund manager
  can take the steps and references directly into a custodian dispute or tax authority reclaim filing.

  ---
  How our agent is adaptable

  Adaptable to new custodians and accounts — The reconciliation engine matches on (custodian, account_number, isin) tuples loaded
  from CSVs. Adding a new custodian requires no code changes; update the data files and the engine reconciles it automatically.

  Adaptable to new tax treaties — The TREATY_SOURCES dict in anthropic_client.py maps bilateral treaty codes to authoritative
  government URLs. Adding a new country pair (e.g. "IT-SE") means adding one dict entry; Claude's prompt is regenerated
  automatically with the correct sources. The treaty key itself comes from the holdings reference data, so the system self-selects
   the right source set per case.

  Adaptable to conversational context — The orchestrator preserves rolling conversation history and an action_context object that
  describes what the user is currently looking at. This means the agent handles follow-up questions ("what documentation do I
  need?", "how long will this take?") without the user re-specifying the errand — Claude resolves references from prior turns and
  the injected context.

  Adaptable to intent ambiguity — Rather than rigid keyword matching, intent routing runs through Claude. This means phrasing like
   "can you check what happened with the Nordea payment?" routes correctly to analyze without any pattern matching code. Adding a
  new intent type means updating the system prompt and adding a dispatch branch — no NLP pipeline to retrain.

  Adaptable to AI failures — Every AI call site has a defined fallback. generate_action_steps catches exceptions and returns
  FALLBACK_STEPS — hardcoded but correct recovery guidance. The cache layer means a transient API failure on a previously seen
  input never blocks the user. The system degrades gracefully rather than failing silently or expensively.