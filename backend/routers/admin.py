import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.auth import get_current_user, require_role
from backend.db import get_db_connection
from backend.helpers import api_error
from backend.services import admin as admin_service

logger = logging.getLogger("kabadilink.routers.admin")
router = APIRouter(tags=["Admin"])


def _require_collector_owner(conn, collector_id: str, current_user: dict) -> None:
    if current_user.get("role") == "ADMIN":
        return
    with conn.cursor() as cur:
        cur.execute("SELECT user_id FROM collectors WHERE id = %s;", (collector_id,))
        row = cur.fetchone()
    if not row:
        api_error(404, "COLLECTOR_NOT_FOUND", "Collector not found")
    if str(row["user_id"]) != str(current_user["id"]):
        api_error(403, "FORBIDDEN", "You can only view your own impact summary")


class ReviewDocRequest(BaseModel):
    status: Literal["APPROVED", "REJECTED"]


class DatasetExportRequest(BaseModel):
    export_type: str


@router.get("/admin/overview")
def overview(current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return admin_service.get_overview(conn)


@router.get("/admin/verification-queue")
def verification_queue(limit: int = 50, offset: int = 0, current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return admin_service.get_verification_queue(conn, limit, offset)


@router.post("/admin/verification-docs/{doc_id}/review")
def review_verification_doc(doc_id: int, payload: ReviewDocRequest, current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return admin_service.review_verification_doc(conn, doc_id, payload.status, current_user["id"])


@router.get("/admin/audit-log")
def audit_log(entity_type: Optional[str] = None, limit: int = 50, offset: int = 0, current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return admin_service.get_audit_log(conn, entity_type, limit, offset)


@router.get("/admin/impact-summary")
def impact_summary(current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return admin_service.get_impact_summary(conn)


@router.get("/collectors/{collector_id}/impact-summary")
def collector_impact_summary(collector_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        _require_collector_owner(conn, collector_id, current_user)
        return admin_service.get_collector_impact_summary(conn, collector_id)


@router.post("/admin/dataset-export")
def create_dataset_export(payload: DatasetExportRequest, current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return admin_service.create_dataset_export(conn, payload.export_type, current_user["id"])


@router.get("/admin/dataset-export/{export_id}")
def get_dataset_export(export_id: int, current_user: dict = Depends(require_role(["ADMIN"]))):
    with get_db_connection() as conn:
        return admin_service.get_dataset_export(conn, export_id)
