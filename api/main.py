"""
FastAPI application entry-point for the AI Risk Manager.

Run locally with:
    uvicorn api.main:app --reload --host 127.0.0.1 --port 8000

Interactive docs are served at /docs (Swagger) and /redoc (ReDoc).
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import _load_models, router
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
