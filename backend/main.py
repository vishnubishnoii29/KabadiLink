import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from backend.config import settings
from backend.db import init_db_pool, close_db_pool
from backend.routers import (
    health, auth, lots, offers, recyclers, handover, disputes,
    notifications, epr, admin, uploads, whatsapp, ai, safety,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kabadilink.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database pool
    logger.info("Starting up KabadiLink API backend...")
    init_db_pool()
    yield
    # Shutdown: clean up resources
    logger.info("Shutting down KabadiLink API backend...")
    close_db_pool()

app = FastAPI(
    title=settings.APP_NAME,
    description="KabadiLink Marketplace & EPR Compliance Backend API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every error must come back as {error: {code, message}} (02-backend-api.md's cross-cutting
# conventions) — without these two handlers, FastAPI's defaults wrap our already-shaped
# HTTPException.detail (set by helpers.api_error) in an extra {"detail": ...} envelope.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        content = exc.detail
    else:
        content = {"error": {"code": "HTTP_ERROR", "message": str(exc.detail)}}
    return JSONResponse(status_code=exc.status_code, content=content)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "VALIDATION_ERROR", "message": str(exc.errors())}}
    )

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error processing {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."}}
    )

# Include Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(lots.router)
app.include_router(offers.router)
app.include_router(recyclers.router)
app.include_router(handover.router)
app.include_router(disputes.router)
app.include_router(notifications.router)
app.include_router(epr.router)
app.include_router(admin.router)
app.include_router(uploads.router)
app.include_router(whatsapp.router)
app.include_router(ai.router)
app.include_router(safety.router)

# Local object storage fallback (used whenever SUPABASE_URL/SUPABASE_KEY aren't configured).
os.makedirs(settings.LOCAL_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.LOCAL_UPLOAD_DIR, check_dir=False), name="uploads")

@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "health_db": "/health/db"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
