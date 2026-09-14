import logging

from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from backend.db import get_db_connection
from backend.services import notifications as notifications_service

logger = logging.getLogger("kabadilink.routers.notifications")
router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(limit: int = 50, offset: int = 0, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return notifications_service.list_notifications(conn, current_user["id"], limit, offset)


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        return notifications_service.mark_read(conn, notification_id, current_user["id"])
