import random
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from backend.config import settings
from backend.db import get_db_connection

logger = logging.getLogger("kabadilink.auth")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    if not hashed_password:
        return False
    try:
        plain_bytes = plain_password.encode("utf-8")[:72]
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    plain_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_bytes, salt).decode("utf-8")

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def generate_otp_code() -> str:
    """Generates a secure 6-digit numeric OTP."""
    return f"{random.randint(100000, 999999)}"

def create_and_store_otp(conn: Any, phone: str, user_id: Optional[str] = None, channel: str = "DEV_LOG") -> str:
    """Stores a generated OTP code in otp_codes table and delivers per channel."""
    code = generate_otp_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRATION_MINUTES)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO otp_codes (user_id, phone, code, delivery_channel, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, phone, code, channel, expires_at)
        )

    if channel == "DEV_LOG" or settings.OTP_DELIVERY_MODE == "DEV_LOG":
        logger.info(f"[DEV_LOG OTP] Verification code for {phone}: {code}")

    return code

def verify_stored_otp(conn: Any, phone: str, code: str) -> bool:
    """Verifies an active, unexpired OTP code and marks it verified."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, expires_at FROM otp_codes
            WHERE phone = %s AND code = %s AND verified_at IS NULL AND expires_at > NOW()
            ORDER BY id DESC LIMIT 1
            """,
            (phone, code)
        )
        row = cur.fetchone()
        if not row:
            return False

        otp_id = row["id"]
        cur.execute(
            "UPDATE otp_codes SET verified_at = NOW() WHERE id = %s",
            (otp_id,)
        )
        return True

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """Dependency extracting and verifying current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "UNAUTHORIZED", "message": "Could not validate authentication credentials"}},
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        phone: Optional[str] = payload.get("phone")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Fetch user details from DB
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, phone, role, preferred_language, is_adult FROM users WHERE id = %s", (user_id,))
                user = cur.fetchone()
                if user is None:
                    raise credentials_exception
                return dict(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user from database: {e}")
        # Return token payload attributes as fallback if DB is momentarily unreachable
        return {"id": user_id, "role": role, "phone": phone}

def require_role(allowed_roles: List[str]):
    """Role-based access control dependency factory."""
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": f"Operation not permitted for role: {user_role}"}}
            )
        return current_user
    return role_checker
