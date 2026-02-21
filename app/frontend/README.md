# PayScope Frontend

React SPA for the PayScope dividend reconciliation agent.

## Stack

- **React 18** + TypeScript
- **Vite** – build tool & dev server
- **Tailwind CSS** – styling

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Runs the Vite dev server at [http://localhost:5173](http://localhost:5173). API requests to `/api` are proxied to `http://localhost:8000`.

## Build

```bash
npm run build
```

Outputs to `dist/`.

## Preview Production Build

```bash
npm run preview
```

## Project Structure

```
app/frontend/
├── src/
│   ├── api/           # API client (chat, reconcile, PDFs, etc.)
│   ├── components/    # React components
│   ├── context/       # WorkspaceContext (state, chat, actions)
│   ├── types/         # TypeScript interfaces
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Environment

| Variable      | Description                            |
|---------------|----------------------------------------|
| `VITE_API_URL`| API base URL (default: `/api`)         |

## Key Components

- **ActionListPanel** – List of recovery actions from dividend season
- **ActionDetailPanel** – Action details, steps, official sources, chat
- **ReconciliationView** – Expected vs received discrepancy list
- **MessageList** – Chat messages with rich content (analysis, PDF extractions)
