"""
FastAPI application entry-point for the AI Risk Manager.

Run locally with:
    uvicorn api.main:app --reload --host 127.0.0.1 --port 8000

Interactive docs are served at /docs (Swagger) and /redoc (ReDoc).
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.routes import _load_models, router
from api.routes_upload import router as upload_router
from api.routes_alerts import router as alerts_router
from api.routes_reports import router as reports_router
from api.routes_ai_models import router as ai_models_router
from api.routes_auth import router as auth_router
from src.audit import log_event
from src.config import KB_MIN_DOCUMENTS
from src.database import create_tables, init_engine
from src.models_db import EventType
from src.utils import logger


# ---------------------------------------------------------------------------
# Lifespan — load trained artifacts ONCE at startup, release on shutdown.
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hook.

    Models are loaded eagerly so the first request does not pay the cold-start
    penalty.  If the training artifacts do not exist the API still boots but
    ``POST /predict`` will return 503 until they are generated.

    The database engine is also initialised and tables are created on startup
    so the prediction log is ready before the first request arrives.
    """
    logger.info("Initialising database engine …")
    try:
        engine = init_engine()
        create_tables(engine)
        logger.info("Database tables created / verified.")
    except Exception as exc:
        logger.warning(f"Database initialisation failed — predictions will not be persisted: {exc}")

    logger.info("Loading trained model artifacts …")
    _load_models()
    logger.info("AI Risk Manager API is ready.")

    # Auto-generate alerts for existing high/medium risk transactions missing alerts
    try:
        import json as _json
        from datetime import datetime, timezone
        from src.database import get_db_session
        from src.models_db import Alert, RiskPrediction, Transaction

        with get_db_session() as session:
            existing_alert_txn_ids = {a.transaction_id for a in session.query(Alert.transaction_id).all()}
            flagged = (
                session.query(RiskPrediction)
                .filter(RiskPrediction.risk_level.in_(["HIGH", "MEDIUM"]))
                .order_by(RiskPrediction.risk_score.desc())
                .all()
            )
            created = 0
            for pred in flagged:
                if pred.transaction_id in existing_alert_txn_ids:
                    continue
                factors = None
                if pred.triggered_risk_factors:
                    try:
                        factors = _json.loads(pred.triggered_risk_factors)
                    except Exception:
                        factors = [pred.triggered_risk_factors] if pred.triggered_risk_factors else None
                alert = Alert(
                    transaction_id=pred.transaction_id,
                    risk_score=pred.risk_score,
                    risk_level=pred.risk_level,
                    reason=_json.dumps(factors) if factors else None,
                    status="OPEN",
                    created_at=datetime.now(timezone.utc),
                )
                session.add(alert)
                created += 1
            session.commit()
            if created:
                logger.info(f"Auto-created {created} alerts for existing flagged transactions.")
    except Exception as exc:
        logger.warning(f"Auto-alert generation skipped: {exc}")

    # Validate knowledge base documents exist
    try:
        from rag.document_loader import validate_knowledge_base
        kb_result = validate_knowledge_base()
        if kb_result.is_valid:
            logger.info(
                f"Knowledge base validated: {kb_result.doc_count} document(s) loaded."
            )
        elif kb_result.doc_count < KB_MIN_DOCUMENTS:
            logger.warning(
                f"Knowledge base has {kb_result.doc_count} document(s), "
                f"minimum required is {KB_MIN_DOCUMENTS}. "
                f"RAG retrieval will not function."
            )
        if kb_result.errors:
            for err in kb_result.errors:
                logger.warning(f"KB validation: {err}")
    except Exception as exc:
        logger.warning(f"Knowledge base validation skipped: {exc}")

    log_event(event_type=EventType.SYSTEM_STARTUP, actor="system")
    yield
    log_event(event_type=EventType.SYSTEM_SHUTDOWN, actor="system")
    logger.info("Shutting down AI Risk Manager API.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI Risk Manager",
    description=(
        "Real-time fraud detection and risk scoring API. "
        "Scores transactions via a supervised RandomForest classifier "
        "and an optional unsupervised IsolationForest anomaly detector."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(upload_router)
app.include_router(alerts_router)
app.include_router(reports_router)
app.include_router(ai_models_router)
app.include_router(auth_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Operations"])
def health_check():
    """Lightweight liveness probe for load-balancers and orchestrators."""
    return {
        "status": "healthy",
        "service": "ai-risk-manager",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Serve frontend static files (built React app)
# ---------------------------------------------------------------------------

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="static-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(request: Request, full_path: str):
        """Catch-all: serve static files or fall back to index.html for SPA routing."""
        file_path = FRONTEND_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(str(file_path))
        index_path = FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return {"detail": "Not Found"}, 404
else:
    logger.warning(f"Frontend build directory not found at {FRONTEND_DIR} — SPA will not be served.")
