# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PayScope** is an AI-powered dividend reconciliation agent for asset managers. It compares expected vs received dividend payments across custodians, identifies discrepancies, and uses Claude AI to suggest recovery actions with official tax treaty source references.

## Development Commands

### Backend (FastAPI + Python)

```bash
cd app/backend
uv sync                                          # Install dependencies
uv run uvicorn main:app --reload --port 8000     # Start dev server
```

Requires `ANTHROPIC_API_KEY` in `app/backend/.env` (copy from `.env.example`).

### Frontend (React + Vite)

```bash
cd app/frontend
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # TypeScript check + production build
```

The frontend proxies `/api/*` to `http://localhost:8000`.

### Utility Scripts

```bash
cd scripts
uv run generate_mock_errands.py   # Regenerate mock dividend season errand data
```

### Health Check

```bash
curl http://localhost:8000/health         # {"status": "ok"}
# Swagger docs available at:
# http://localhost:8000/docs
```

## Architecture

### Backend (`app/backend/`)

- **`main.py`** – FastAPI app entry point; configures CORS and mounts all routers under `/api`
- **`routes/`** – Thin API handlers, one file per feature: `reconcile`, `analyze`, `chat`, `dividend_season`, `pdf`, `data`
- **`services/`** – Business logic:
  - `anthropic_client.py` – Claude API wrapper with **file-based caching** in `app/backend/cache/` (SHA-256 keyed JSON files). All Claude calls go through here.
  - `orchestrator.py` – Intent parsing: the `/api/chat` endpoint uses Claude to determine user intent (`reconcile` / `analyze` / `extract_pdf` / `general`) and dispatches accordingly
  - `reconciliation.py` – Matches expected vs received payments, classifies discrepancies (`TAX_ERROR`, `MISSING_PAYMENT`, `AMOUNT_MISMATCH`, `OVERPAYMENT`)
  - `dividend_season_producer.py` – Streams action items for errand entries via SSE
  - `worthiness.py` – Evaluates whether an errand is worth pursuing
- **`models/schemas.py`** – All Pydantic models (also mirrored as TypeScript interfaces in `app/frontend/src/types/index.ts`)
- **`cache/`** – AI response cache; clear this directory to force fresh Claude calls

### Frontend (`app/frontend/src/`)

- **`App.tsx`** – Root 3-panel resizable layout: stream console (left), action list (center), detail/chat panel (right)
- **`context/WorkspaceContext.tsx`** – Global React Context managing messages, action items, streaming state
- **`api/client.ts`** – Typed fetch wrapper for all REST endpoints
- **`api/dividendSeason.ts`** – SSE subscription for the dividend season stream
- Components are in `components/` and are self-explanatory from their names

### Data Flow

1. **Reconciliation:** CSV files (`files/v2_data/`) → `data_loader.py` → `reconciliation.py` → discrepancies
2. **AI Analysis:** Discrepancy → `anthropic_client.py` → structured JSON with verification steps, root cause, recommendation, recoverable amount, timeline
3. **Dividend Season:** `files/dividend_season/errands.json` → worthiness evaluation → AI action steps with treaty source references → streamed via SSE
4. **Chat:** User message → orchestrator intent parse → appropriate service → response

### Claude AI Integration

- Model: `claude-sonnet-4-20250514` (hardcoded in `services/anthropic_client.py`)
- All AI calls are cached to `app/backend/cache/` — delete cache files to re-run with fresh responses
- `TREATY_SOURCES` dict in `anthropic_client.py` maps tax treaty codes (e.g. `"US-SE"`, `"CA-NO"`) to authoritative government URLs included in AI prompts

### Key Data Files

- `files/v2_data/expected_payments_v2.csv` – Expected dividend payments
- `files/v2_data/received_payments_v2.csv` – Actual received payments from custodians
- `files/v2_data/holdings_reference.csv` – Holdings data
- `files/v2_data/tax_treaty_reference.csv` – Tax treaty rates
- `files/dividend_season/errands.json` – Dividend season errand entries (regenerate with `scripts/generate_mock_errands.py`)
- `public/pdfs/` – Sample custodian PDF statements

### TypeScript / Python Schema Sync

Pydantic models in `app/backend/models/schemas.py` and TypeScript interfaces in `app/frontend/src/types/index.ts` must be kept in sync manually — there is no code generation.
