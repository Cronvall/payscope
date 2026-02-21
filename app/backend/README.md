# PayScope Backend

FastAPI backend for the PayScope dividend reconciliation agent. Handles reconciliation logic, AI analysis via Claude, PDF extraction, and the dividend season stream.

## Stack

- **uv** – Python package manager & runner
- **FastAPI** – REST API
- **Pydantic** – Data validation
- **Anthropic Claude** – AI analysis and action step generation
- **python-dotenv** – Environment config

## Setup

```bash
cd app/backend
uv sync
cp .env.example .env
```

Edit `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Run

From `app/backend`:

```bash
uv run uvicorn main:app --reload --port 8000
```

**Note:** Use `main:app` (not `app.main:app`). The app module is `main.py` in the backend root.

API: [http://localhost:8000](http://localhost:8000)  
Health: [http://localhost:8000/health](http://localhost:8000/health)  
Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Project Structure

```
app/backend/
├── models/           # Pydantic schemas
├── routes/           # API endpoints
│   ├── analyze.py   # Discrepancy AI analysis
│   ├── chat.py      # Intent parsing, chat
│   ├── data.py      # Expected/received payments
│   ├── dividend_season.py  # SSE stream
│   ├── pdf.py       # List & extract PDFs
│   └── reconcile.py # Reconciliation
├── services/
│   ├── anthropic_client.py  # Claude API, action steps, treaty refs
│   ├── data_loader.py       # Load CSV data
│   ├── dividend_season_producer.py
│   ├── orchestrator.py      # Chat intent
│   ├── pdf_parser.py        # PDF extraction
│   └── worthiness.py        # Errand evaluation
├── cache/           # Cached AI responses (action_steps_*.json)
├── main.py
├── pyproject.toml   # Project deps (uv)
└── uv.lock          # Lockfile (uv)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payments/expected` | Expected payments (CSV) |
| GET | `/api/payments/received` | Received payments (CSV) |
| POST | `/api/reconcile` | Run reconciliation |
| POST | `/api/analyze` | AI discrepancy analysis |
| POST | `/api/chat` | Chat (reconcile, analyze, extract, general) |
| GET | `/api/pdf/list` | List PDFs |
| POST | `/api/pdf/extract` | Extract payment data from PDF |
| GET | `/api/dividend-season/stream` | SSE stream (errands → actions) |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |

## AI Features

- **Discrepancy analysis** – Root cause, verification steps, recommendation
- **Action steps** – Case-specific next steps with official government/treaty references (OECD, Skatteetaten, country finance ministries)
- **Chat orchestration** – Intent parsing for reconciliation, analysis, PDF extraction

## Caching

AI responses (action steps, analyses) are cached in `cache/` as JSON. Delete cache files to regenerate responses.
