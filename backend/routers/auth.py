import logging
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from backend.db import get_db_connection
from backend.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_and_store_otp,
    verify_stored_otp,
    get_current_user
)
from backend.helpers import audit
from backend.services import users as users_service

logger = logging.getLogger("kabadilink.routers.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    password: Optional[str] = None
    role: Literal["COLLECTOR", "RECYCLER", "ADMIN"] = "COLLECTOR"
    name: Optional[str] = None
    preferred_language: Literal["en", "hi", "mr"] = "en"
    is_adult: bool = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class LoginRequest(BaseModel):
    phone: str
    password: str

class OTPRequest(BaseModel):
    phone: str
    delivery: Literal["DEV_LOG", "EMAIL", "WHATSAPP"] = "DEV_LOG"

class OTPVerifyRequest(BaseModel):
    phone: str
    code: str

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    """Registers a new collector, recycler, or admin."""
    password_hash = get_password_hash(payload.password) if payload.password else None
    user_name = payload.name or f"{payload.role.capitalize()}-{payload.phone[-4:]}"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Check existing
            cur.execute("SELECT id FROM users WHERE phone = %s;", (payload.phone,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": {"code": "PHONE_EXISTS", "message": "Phone number is already registered"}}
                )

            # Insert user
            cur.execute(
                """
                INSERT INTO users (phone, password_hash, role, preferred_language, is_adult)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (payload.phone, password_hash, payload.role, payload.preferred_language, payload.is_adult)
            )
            user_row = cur.fetchone()
            user_id = str(user_row["id"])

            # Create specific role profile
            if payload.role == "COLLECTOR":
                cur.execute(
                    """
                    INSERT INTO collectors (user_id, name, latitude, longitude)
                    VALUES (%s, %s, %s, %s);
                    """,
                    (user_id, user_name, payload.latitude, payload.longitude)
                )
            elif payload.role == "RECYCLER":
                cur.execute(
                    """
                    INSERT INTO recyclers (user_id, name, latitude, longitude)
                    VALUES (%s, %s, %s, %s);
                    """,
                    (user_id, user_name, payload.latitude or 0.0, payload.longitude or 0.0)
                )

            audit(conn, user_id, "USER_REGISTERED", "users", user_id, metadata={"role": payload.role})

    token = create_access_token({"sub": user_id, "role": payload.role, "phone": payload.phone})
    return {"user_id": user_id, "phone": payload.phone, "role": payload.role, "token": token}

@router.post("/login")
def login(payload: LoginRequest):
    """Password-based login flow."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, phone, password_hash, role, preferred_language FROM users WHERE phone = %s;",
                (payload.phone,)
            )
            user = cur.fetchone()
            if not user or not verify_password(payload.password, user["password_hash"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"error": {"code": "INVALID_CREDENTIALS", "message": "Invalid phone number or password"}}
                )

            user_id = str(user["id"])
            audit(conn, user_id, "USER_LOGIN_PASSWORD", "users", user_id)

    token = create_access_token({"sub": user_id, "role": user["role"], "phone": user["phone"]})
    return {"token": token, "user_id": user_id, "role": user["role"]}

@router.post("/otp/request")
def request_otp(payload: OTPRequest):
    """Requests a zero-cost OTP. Returns code directly if DEV_LOG is enabled."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE phone = %s;", (payload.phone,))
            user = cur.fetchone()
            user_id = str(user["id"]) if user else None

        code = create_and_store_otp(conn, payload.phone, user_id=user_id, channel=payload.delivery)
        audit(conn, user_id, "OTP_REQUESTED", "otp_codes", payload.phone, metadata={"channel": payload.delivery})

    response = {"requested": True, "delivery": payload.delivery}
    if payload.delivery == "DEV_LOG":
        response["dev_code"] = code
    return response

@router.post("/otp/verify")
def verify_otp(payload: OTPVerifyRequest):
    """Verifies OTP and generates session JWT."""
    with get_db_connection() as conn:
        if not verify_stored_otp(conn, payload.phone, payload.code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "INVALID_OTP", "message": "Invalid or expired OTP code"}}
            )

        with conn.cursor() as cur:
            cur.execute("SELECT id, phone, role FROM users WHERE phone = %s;", (payload.phone,))
            user = cur.fetchone()
            if not user:
                # Auto-register as COLLECTOR if new phone verifies OTP
                cur.execute(
                    "INSERT INTO users (phone, role) VALUES (%s, 'COLLECTOR') RETURNING id, role;",
                    (payload.phone,)
                )
                user = cur.fetchone()
                user_id = str(user["id"])
                cur.execute(
                    "INSERT INTO collectors (user_id, name) VALUES (%s, %s);",
                    (user_id, f"Collector-{payload.phone[-4:]}")
                )
            else:
                user_id = str(user["id"])

            audit(conn, user_id, "USER_LOGIN_OTP", "users", user_id)

    token = create_access_token({"sub": user_id, "role": user["role"], "phone": payload.phone})
    return {"token": token, "user_id": user_id, "role": user["role"]}

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the authenticated user profile, plus collector_id/recycler_id if applicable."""
    with get_db_connection() as conn:
        return users_service.attach_role_scoped_id(conn, dict(current_user))

@router.post("/logout")
def logout():
    """Client-side token disposal."""
    return {"ok": True}
