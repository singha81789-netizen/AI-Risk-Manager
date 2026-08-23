"""
Database engine, session management, and table creation for PostgreSQL via SQLAlchemy.
"""

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from src.models_db import Base

# ---------------------------------------------------------------------------
# Engine & Session Factory — initialised lazily on first use.
# ---------------------------------------------------------------------------

_engine: Engine | None = None
_SessionFactory: sessionmaker | None = None


def get_database_url() -> str:
    """Build the PostgreSQL connection URL from environment variables.

    Required env vars:
        POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB

    Returns a ``postgresql+psycopg2://`` URL.
    """
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "ai_risk_manager")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"


def init_engine(url: str | None = None, **kwargs) -> Engine:
    """Create (or return the cached) SQLAlchemy engine.

    Parameters
    ----------
    url : str, optional
        Override the database URL.  When *None* the URL is built from
        environment variables via :func:`get_database_url`.
    **kwargs
        Extra keyword arguments forwarded to :func:`sqlalchemy.create_engine`.
    """
    global _engine
    if _engine is not None:
        return _engine

    if url is None:
        url = get_database_url()

    defaults = {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 10}
    defaults.update(kwargs)
    _engine = create_engine(url, **defaults)
    return _engine


def get_engine() -> Engine:
    """Return the singleton engine, initialising it if necessary."""
    global _engine
    if _engine is None:
        return init_engine()
    return _engine


def init_session_factory(engine: Engine | None = None) -> sessionmaker:
    """Create (or return the cached) session factory."""
    global _SessionFactory
    if _SessionFactory is not None:
        return _SessionFactory

    if engine is None:
        engine = get_engine()
    _SessionFactory = sessionmaker(bind=engine, expire_on_commit=False)
    return _SessionFactory


def get_session_factory() -> sessionmaker:
    """Return the singleton session factory."""
    global _SessionFactory
    if _SessionFactory is None:
        return init_session_factory()
    return _SessionFactory


# ---------------------------------------------------------------------------
# Dependency for FastAPI / direct usage
# ---------------------------------------------------------------------------

@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Yield a transactional DB session; commits on success, rolls back on error."""
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def db_session_dependency() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session and closes it after use."""
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Table creation
# ---------------------------------------------------------------------------

def create_tables(engine: Engine | None = None) -> None:
    """Create all tables defined by :mod:`src.models_db`."""
    if engine is None:
        engine = get_engine()
    Base.metadata.create_all(bind=engine)


def drop_tables(engine: Engine | None = None) -> None:
    """Drop all tables (use with caution — mainly for testing)."""
    if engine is None:
        engine = get_engine()
    Base.metadata.drop_all(bind=engine)


def reset_engine() -> None:
    """Reset cached engine and session factory (useful for testing)."""
    global _engine, _SessionFactory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionFactory = None
