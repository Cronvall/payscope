# PayScope

AI-powered dividend reconciliation agent for asset managers. Compares expected vs received dividend payments across custodians, identifies discrepancies, and suggests recovery actions with references to official tax treaty sources.

## Overview

**Problem:** Asset managers receive thousands of dividend payments across multiple custodians. Payments arrive late, incorrect, or not at all. Current reconciliation is manual and slow.

**Solution:** PayScope ingests custodian statements (PDFs), extracts payment data, compares against expected holdings, and uses AI to analyze discrepancies and recommend next steps—with links to government and treaty organization sources that support tax reclaim claims. Discrepancies become tracked cases that move through a Kanban workflow, with AI-assisted form filling for official reclaim submissions.

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (React + Vite + Tailwind)     │
│  - WorkspacePage: reconciliation chat   │
│  - CasesKanbanPage: case management     │
│  - Dividend season action list          │
│  - PDF extraction & chat                │
└─────────────────────────────────────────┘
                    │
                    ▼  /api proxy
┌─────────────────────────────────────────┐
│  Backend (FastAPI + Python)             │
│  - Reconciliation logic                 │
│  - Claude AI (analysis, action steps)   │
│  - Case lifecycle (db/)                 │
│  - PDF parsing & form filling           │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Data (CSV, JSON, PDFs, SQLite)         │
│  - files/v2_data/ (payment CSVs)        │
│  - files/dividend_season/errands.json   │
│  - files/form_templates/ (PDF forms)    │
│  - files/client_profiles/profiles.json  │
│  - files/case_attachments/ (filled PDFs)│
│  - app/backend/data/payscope.db         │
└─────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js** (v18+)
- **uv** – [install](https://docs.astral.sh/uv/getting-started/installation/)
- **Anthropic API key** for Claude

### 1. Backend

```bash
cd app/backend
uv sync
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=sk-ant-...
uv run uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd app/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend proxies `/api` to the backend at port 8000.

Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Project Structure

```
payscope/
├── app/
│   ├── backend/
│   │   ├── main.py               # FastAPI entry point, CORS, router mounts
│   │   ├── routes/               # Thin API handlers
│   │   │   ├── reconcile.py
│   │   │   ├── analyze.py
│   │   │   ├── chat.py
│   │   │   ├── dividend_season.py
│   │   │   ├── pdf.py
│   │   │   ├── data.py
│   │   │   ├── cases.py          # Case lifecycle (list, get, status transition)
│   │   │   └── forms.py          # Form filling & case attachments
│   │   ├── services/             # Business logic
│   │   │   ├── anthropic_client.py
│   │   │   ├── orchestrator.py
│   │   │   ├── reconciliation.py
│   │   │   ├── dividend_season_producer.py
│   │   │   ├── worthiness.py
│   │   │   ├── form_filler.py    # PDF form filling with pypdf
│   │   │   ├── data_loader.py
│   │   │   └── pdf_parser.py
│   │   ├── db/                   # SQLite persistence layer
│   │   │   ├── schema.sql
│   │   │   ├── case_repository.py
│   │   │   └── attachment_repository.py
│   │   ├── models/
│   │   │   └── schemas.py        # Pydantic models (mirrored in frontend types/)
│   │   ├── cache/                # SHA-256 keyed AI response cache (JSON files)
│   │   └── data/                 # SQLite database file
│   └── frontend/src/
│       ├── App.tsx               # Root layout, routing
│       ├── pages/
│       │   ├── WorkspacePage.tsx # 3-panel: stream console / action list / chat
│       │   └── CasesKanbanPage.tsx
│       ├── context/
│       │   └── WorkspaceContext.tsx
│       ├── api/
│       │   ├── client.ts
│       │   └── dividendSeason.ts
│       └── components/           # UI components
├── files/
│   ├── v2_data/                  # Payment CSVs and reference data
│   ├── dividend_season/          # errands.json
│   ├── form_templates/           # PDF form templates + field mappings + registry.json
│   ├── client_profiles/          # profiles.json (client data for form pre-fill)
│   └── case_attachments/         # Filled PDF forms, organized by action ID
├── scripts/
│   └── generate_mock_errands.py
└── context/                      # Technical specs, prompts
```

## Features

- **Reconciliation** – Compare expected vs received payments; discrepancy types: `TAX_ERROR`, `MISSING_PAYMENT`, `AMOUNT_MISMATCH`, `OVERPAYMENT`
- **AI Analysis** – Root cause, verification steps, recovery recommendations, recoverable amount, timeline
- **Dividend Season** – Stream errands via SSE, evaluate worthiness, generate AI action steps with official tax treaty references (OECD, Skatteetaten, country finance ministries)
- **Cases Kanban** – Discrepancies tracked as cases with status transitions through a Kanban board
- **Form Filling** – AI-assisted filling of official reclaim forms (IB92, FW-8BEN-E, etc.) from client profile data; saved as case attachments
- **PDF Extraction** – Extract payment data from custodian PDFs
- **Chat** – Intent-parsing orchestrator routes questions to reconciliation, analysis, or PDF extraction

## Key Implementation Details

### AI Caching

All Claude calls go through `services/anthropic_client.py`, which caches responses as SHA-256-keyed JSON files in `app/backend/cache/`. Delete files in that directory to force fresh AI calls.

### Case Persistence

Cases are stored in SQLite (`app/backend/data/payscope.db`) via the `db/` repository layer. `case_repository.py` handles CRUD and status transitions; `attachment_repository.py` tracks filled forms linked to each case.

### Form Filling Pipeline

`services/form_filler.py` reads `files/form_templates/registry.json` to discover available PDF templates and their field mappings. It looks up the case's client profile from `files/client_profiles/profiles.json` and uses `pypdf` to fill AcroForm fields. Filled PDFs are saved to `files/case_attachments/` and registered in the database.

### Schema Sync

Pydantic models in `app/backend/models/schemas.py` and TypeScript interfaces in `app/frontend/src/types/index.ts` are kept in sync manually—there is no code generation.

## Key Data Files

| File | Purpose |
|------|---------|
| `files/v2_data/expected_payments_v2.csv` | Expected dividend payments |
| `files/v2_data/received_payments_v2.csv` | Actual received payments from custodians |
| `files/v2_data/holdings_reference.csv` | Holdings data |
| `files/v2_data/tax_treaty_reference.csv` | Tax treaty rates |
| `files/dividend_season/errands.json` | Dividend season errand entries |
| `files/form_templates/registry.json` | Form template registry with field mappings |
| `files/client_profiles/profiles.json` | Client data used to pre-fill forms |

## License

Private / internal use.
