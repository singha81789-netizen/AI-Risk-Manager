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
    """
    logger.info("Loading trained model artifacts …")
    _load_models()
    logger.info("AI Risk Manager API is ready.")
    yield
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
