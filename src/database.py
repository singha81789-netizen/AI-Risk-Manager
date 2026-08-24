"""
Database engine, session management, and table creation for PostgreSQL via SQLAlchemy.
Falls back to SQLite when PostgreSQL is unavailable.
"""

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from src.models_db import Base

# ---------------------------------------------------------------------------
# Engine & Session Factory — initialised lazily on first use.
# ---------------------------------------------------------------------------

_engine: Engine | None = None
_SessionFactory: sessionmaker | None = None
_is_sqlite: bool = False


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
    global _engine, _is_sqlite
    if _engine is not None:
        return _engine

    if url is not None:
        # Explicit URL override (used in tests or SQLite fallback)
        defaults = {"pool_pre_ping": True}
        defaults.update(kwargs)
        _engine = create_engine(url, **defaults)
        _is_sqlite = "sqlite" in url
        if _is_sqlite:
            _enable_sqlite_wal(_engine)
        return _engine

    # Try PostgreSQL first, fall back to SQLite
    pg_url = get_database_url()
    try:
        test_engine = create_engine(pg_url, pool_pre_ping=True, connect_args={"connect_timeout": 3})
        with test_engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        test_engine.dispose()
        # PostgreSQL is available
        defaults = {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 10}
        defaults.update(kwargs)
        _engine = create_engine(pg_url, **defaults)
        _is_sqlite = False
        return _engine
    except Exception:
        # PostgreSQL not available — fall back to SQLite
        sqlite_path = os.path.join(os.path.dirname(__file__), "..", "data", "ai_risk_manager.db")
        sqlite_url = f"sqlite:///{os.path.abspath(sqlite_path)}"
        defaults = {"pool_pre_ping": True}
        defaults.update(kwargs)
        _engine = create_engine(sqlite_url, **defaults)
        _is_sqlite = True
        _enable_sqlite_wal(_engine)
        return _engine


def _enable_sqlite_wal(engine: Engine) -> None:
    """Enable WAL journal mode and foreign keys for SQLite."""
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


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
    global _engine, _SessionFactory, _is_sqlite
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionFactory = None
    _is_sqlite = False
