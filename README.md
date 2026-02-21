# PayScope

AI-powered dividend reconciliation agent for asset managers. Compares expected vs received dividend payments across custodians, identifies discrepancies, and suggests recovery actions with references to official tax treaty sources.

## Overview

**Problem:** Asset managers receive thousands of dividend payments across multiple custodians. Payments arrive late, incorrect, or not at all. Current reconciliation is manual and slow.

**Solution:** PayScope ingests custodian statements (PDFs), extracts payment data, compares against expected holdings, and uses AI to analyze discrepancies and recommend next steps—with links to government and treaty organization sources that support tax reclaim claims.

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (React + Vite + Tailwind)     │
│  - Reconciliation dashboard             │
│  - Dividend season / action list        │
│  - PDF extraction & chat                │
└─────────────────────────────────────────┘
                    │
                    ▼  /api proxy
┌─────────────────────────────────────────┐
│  Backend (FastAPI + Python)             │
│  - Reconciliation logic                 │
│  - Claude AI (analysis, action steps)    │
│  - PDF parsing                           │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Data (CSV, JSON, PDFs)                 │
│  - expected_payments_v2.csv              │
│  - received_payments_v2.csv              │
│  - files/dividend_season/errands.json    │
│  - public/pdfs/                          │
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

### 3. Run Both

In two terminals:

- **Terminal 1:** `cd app/backend && uv run uvicorn main:app --reload --port 8000`
- **Terminal 2:** `cd app/frontend && npm run dev`

## Project Structure

```
payscope/
├── app/
│   ├── backend/          # FastAPI API + AI services
│   └── frontend/         # React SPA
├── context/              # Technical specs, prompts
├── files/                # Dividend season data
├── public/               # Static assets, PDFs
├── scripts/              # Utilities (e.g. generate mock data)
└── README.md
```

## Features

- **Reconciliation** – Compare expected vs received payments
- **AI Analysis** – Root cause, verification steps, recovery recommendations
- **Dividend Season** – Stream errands, evaluate worthiness, generate action items
- **Action Steps** – AI-generated next steps with official tax treaty references (OECD, Skatteetaten, country finance ministries)
- **PDF Extraction** – Extract payment data from custodian PDFs
- **Chat** – Ask questions about actions and discrepancies

## License

Private / internal use.
