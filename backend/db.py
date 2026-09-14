import logging
import time
from contextlib import contextmanager
from typing import Generator, Optional, Any
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor
from backend.config import settings

logger = logging.getLogger("kabadilink.db")

_pool: Optional[ThreadedConnectionPool] = None

def init_db_pool(minconn: int = 1, maxconn: int = 10) -> Optional[ThreadedConnectionPool]:
    """Initializes the PostgreSQL threaded connection pool."""
    global _pool
    if _pool is not None and not _pool.closed:
        return _pool

    try:
        # Handle connection parameters cleanly
        db_url = settings.DATABASE_URL
        # Replace postgres:// with postgresql:// if needed
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)

        _pool = ThreadedConnectionPool(
            minconn=minconn,
            maxconn=maxconn,
            dsn=db_url,
            cursor_factory=RealDictCursor
        )
        logger.info("PostgreSQL connection pool initialized successfully.")
        return _pool
    except Exception as e:
        logger.warning(f"Could not initialize PostgreSQL connection pool: {e}. DB operations may fail until valid DATABASE_URL is supplied.")
        _pool = None
        return None

def close_db_pool():
    """Closes all connections in the pool."""
    global _pool
    if _pool is not None and not _pool.closed:
        _pool.closeall()
        logger.info("PostgreSQL connection pool closed.")
        _pool = None

@contextmanager
def get_db_connection() -> Generator[Any, None, None]:
    """
    Context manager providing a database connection with automatic commit/rollback.
    Yields connection with RealDictCursor factory by default.
    """
    global _pool
    if _pool is None:
        init_db_pool()

    if _pool is None:
        raise ConnectionError("Database connection pool is not available. Please verify DATABASE_URL.")

    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if _pool is not None and not _pool.closed:
            _pool.putconn(conn)

@contextmanager
def get_db_cursor() -> Generator[Any, None, None]:
    """Context manager providing a database cursor directly."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            yield cur

def ping_db() -> dict:
    """
    Heartbeat probe executing SELECT 1; against Postgres.
    Used by /health/db to keep Supabase free tier alive.
    """
    start = time.perf_counter()
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT 1 AS alive;")
            row = cur.fetchone()
            duration_ms = (time.perf_counter() - start) * 1000.0
            if row and row.get("alive") == 1:
                return {"status": "connected", "latency_ms": round(duration_ms, 2)}
            return {"status": "unexpected_response", "latency_ms": round(duration_ms, 2)}
    except Exception as e:
        duration_ms = (time.perf_counter() - start) * 1000.0
        return {"status": "error", "error": str(e), "latency_ms": round(duration_ms, 2)}
