# PayScope — State of Affairs

*A project manager’s overview of the current project status*

---

## Executive Summary

**PayScope** is an AI-powered dividend reconciliation tool for asset managers. It compares expected vs. received dividend payments across custodians, identifies discrepancies (tax errors, missing payments, amount mismatches, overpayments), and uses Claude AI to suggest recovery actions with references to official tax treaty sources (OECD, government finance sites, etc.).

The product currently supports:
- CSV-based reconciliation of expected vs. received payments  
- AI-driven discrepancy analysis and recommendations  
- A dividend season workflow that turns errand entries into actionable recovery cases  
- A Kanban-style case management interface  
- Form filling (e.g. W-8BEN-E) tied to cases with PDF attachments  

---

## Product Purpose & Value

| What | Description |
|------|-------------|
| **Problem** | Asset managers face manual, error-prone work reconciling dividend payments across custodians and correcting tax/treaty errors. |
| **Solution** | Automated reconciliation + AI analysis + case-based workflows with treaty-backed recommendations. |
| **Target user** | Asset managers and operations teams handling dividend reconciliations. |

---

## Current Architecture

### High-Level Stack

| Layer | Technology |
|------|------------|
| **Backend** | Python (FastAPI), uv, Pydantic |
| **Frontend** | React, Vite, TypeScript |
| **AI** | Anthropic Claude (claude-sonnet-4-20250514) |
| **Data** | SQLite (`payscope.db`), CSV inputs, PDF extraction |

### Application Structure

```
PayScope
├── app/
│   ├── backend/          # FastAPI REST API
│   │   ├── main.py       # Entry point, CORS, routers
│   │   ├── routes/       # API handlers
│   │   ├── services/     # Business logic
│   │   ├── db/           # Repositories, schema
│   │   ├── models/       # Pydantic schemas
│   │   └── cache/        # Cached AI responses
│   └── frontend/         # React SPA
│       └── src/
│           ├── pages/    # WorkspacePage, CasesKanbanPage
│           ├── components/
│           ├── context/
│           ├── api/
│           └── types/
├── files/                # Data files, form templates, attachments
├── scripts/              # Utility scripts (e.g. mock errand generation)
└── public/               # Static assets
```

### Main Data Flows

1. **Reconciliation:** CSV files → `data_loader` → `reconciliation` → discrepancies
2. **AI analysis:** Discrepancy → Claude → structured output (root cause, steps, recommendation, recoverable amount)
3. **Dividend season:** Errands JSON → worthiness evaluation → AI-generated action steps → SSE stream
4. **Chat:** User message → orchestrator (intent parse) → reconcile / analyze / extract_pdf / general
5. **Cases:** Cases stored in SQLite; status transitions tracked; form filling produces PDF attachments

---

## Key Features

### Implemented Features

| Feature | Description |
|---------|-------------|
| **Reconciliation** | Match expected vs. received payments; classify discrepancies (TAX_ERROR, MISSING_PAYMENT, AMOUNT_MISMATCH, OVERPAYMENT) |
| **AI discrepancy analysis** | Root cause, verification steps, recommendation, recoverable amount, timeline |
| **AI action steps** | Case-specific next steps with official treaty/government references |
| **Dividend season stream** | SSE stream of errands → worthiness → AI action steps |
| **Chat** | Intent parsing for reconciliation, analysis, PDF extraction, general Q&A |
| **PDF extraction** | List PDFs, extract payment data from custodian statements |
| **Case management** | Cases in SQLite with status workflow (NEW → AI_ANALYZED → UNDER_REVIEW → DOCUMENT_REQUESTED → CLAIM_SUBMITTED → RECOVERED / WRITTEN_OFF) |
| **Kanban UI** | Drag-and-drop case board at `/cases` |
| **Form filling** | Fill tax forms (e.g. W-8BEN-E) with case data; store filled PDFs as attachments |
| **Case attachments** | List, download filled PDFs per case |

### API Endpoints (Summary)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/payments/expected` | Expected payments (CSV) |
| GET | `/api/payments/received` | Received payments (CSV) |
| POST | `/api/reconcile` | Run reconciliation |
| POST | `/api/analyze` | AI discrepancy analysis |
| POST | `/api/chat` | Chat with intent routing |
| GET | `/api/pdf/list` | List available PDFs |
| POST | `/api/pdf/extract` | Extract payment data from PDF |
| GET | `/api/dividend-season/stream` | SSE stream of errands → actions |
| GET | `/api/cases` | List cases |
| GET | `/api/cases/{id}` | Get case details |
| PATCH | `/api/cases/{id}` | Transition case status |
| GET | `/api/forms` | List available form types |
| POST | `/api/cases/{id}/forms/fill` | Fill form and attach to case |
| GET | `/api/cases/{id}/attachments` | List case attachments |

---

## Tech Stack Details

### Backend

- **uv** – Package manager and runner
- **FastAPI** – REST API
- **Pydantic** – Data validation
- **python-dotenv** – Environment configuration
- **Anthropic SDK** – Claude API
- **SQLite** – Persistence for cases, attachments, history

### Frontend

- **React** – UI framework
- **Vite** – Build and dev server
- **React Router** – Routing
- **Tailwind CSS** – Styling

### AI

- **Model:** claude-sonnet-4-20250514
- **Caching:** File-based cache in `app/backend/cache/` (SHA-256 keyed JSON)

---

## Key Data Assets

| File / Path | Purpose |
|-------------|---------|
| `files/v2_data/expected_payments_v2.csv` | Expected dividend payments |
| `files/v2_data/received_payments_v2.csv` | Received payments from custodians |
| `files/v2_data/holdings_reference.csv` | Holdings reference |
| `files/v2_data/tax_treaty_reference.csv` | Tax treaty rates |
| `files/dividend_season/errands.json` | Dividend season errand entries |
| `files/form_templates/` | PDF form templates and mappings |
| `files/client_profiles/` | Client profile data |
| `app/backend/data/payscope.db` | SQLite database (cases, attachments, history) |
| `public/pdfs/` | Sample custodian PDF statements |

---

## Development Status

### What’s Working

- Full reconciliation and analysis flow
- Dividend season SSE stream
- Chat orchestration
- Case management and Kanban UI
- Form filling and attachment storage
- API docs at `/docs`

### Recent Additions (from repo state)

- Case lifecycle and status workflow
- Kanban page (`/cases`)
- Form filling service and routes
- Attachment repository and PDF storage
- Database schema for cases, attachments, history

### Constraints & Technical Debt

| Item | Notes |
|------|------|
| **Schema sync** | Pydantic (Python) and TypeScript types are maintained manually; no code generation |
| **AI caching** | All Claude responses cached; delete `cache/` files to force fresh calls |
| **Env dependency** | `ANTHROPIC_API_KEY` required in `app/backend/.env` |
| **Data sources** | Currently file-based (CSV, JSON); no external custodial APIs |
| **Forms** | Form templates and field mappings are configured in `files/form_templates/` |

---

## How to Run

### Backend

```bash
cd app/backend
uv sync
# Ensure ANTHROPIC_API_KEY in .env
uv run uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd app/frontend
npm install
npm run dev   # http://localhost:5173
```

### Health Check

```bash
curl http://localhost:8000/health   # {"status": "ok"}
```

---

## Dependencies & Configuration

| Requirement | Purpose |
|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API access |
| `files/` directory structure | CSV, errands, form templates, client profiles |
| `app/backend/data/` | SQLite DB directory |

---

## Suggested Next Steps (for planning)

1. **Testing** – Add unit/integration tests for reconciliation, form filling, and case workflows
2. **Documentation** – End-user docs or runbooks for reconciliation and case handling
3. **Data integrations** – Evaluate connections to custodial or internal data systems
4. **Performance** – Review cache usage and SSE handling under load
5. **Form coverage** – Extend form types and mappings for additional jurisdictions/treaties
