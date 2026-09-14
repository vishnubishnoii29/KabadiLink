import os
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Response, status
from backend.config import settings
from backend.db import ping_db

router = APIRouter(tags=["Health & Reliability"])

_start_time = time.time()

@router.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """
    Dependency-free liveness probe.
    Does NOT connect to the database or Redis, guaranteeing immediate HTTP 200
    even during cold starts. Used by Render/Railway and GitHub Actions keep-alive.
    """
    uptime_seconds = int(time.time() - _start_time)
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "env": settings.APP_ENV,
        "uptime_seconds": uptime_seconds,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/health/db")
def health_db_check(response: Response):
    """
    Database heartbeat probe.
    Executes SELECT 1; against Postgres to prevent Supabase free tier from
    auto-pausing after 7 days of inactivity.
    """
    db_result = ping_db()
    if db_result.get("status") != "connected":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": db_result.get("status"),
        "database": db_result,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
