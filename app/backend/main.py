import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Load .env from backend dir so it works regardless of CWD
_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir / ".env")

PROJECT_ROOT = _backend_dir.parent.parent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PayScope - AI Dividend Reconciliation Agent",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from db.case_repository import init_db  # noqa: E402
from routes.data import router as data_router  # noqa: E402
from routes.reconcile import router as reconcile_router  # noqa: E402
from routes.analyze import router as analyze_router  # noqa: E402
from routes.pdf import router as pdf_router  # noqa: E402
from routes.chat import router as chat_router  # noqa: E402
from routes.dividend_season import router as dividend_season_router  # noqa: E402
from routes.cases import router as cases_router  # noqa: E402
from routes.forms import router as forms_router  # noqa: E402

init_db()

app.include_router(data_router, prefix="/api")
app.include_router(reconcile_router, prefix="/api")
app.include_router(analyze_router, prefix="/api")
app.include_router(pdf_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(dividend_season_router, prefix="/api")
app.include_router(cases_router, prefix="/api")
app.include_router(forms_router, prefix="/api")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Log unhandled exceptions and return a useful 500 with the error message."""
    from fastapi.responses import JSONResponse

    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/health")
async def health():
    return {"status": "ok"}
