import os
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable is missing. Please set JWT_SECRET in backend/.env")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Returns the payload dict."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise ValueError("No sub")
        return payload
    except jwt.PyJWTError:
        raise ValueError("Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> int:
    """Require a valid JWT. Returns user_id as int."""
    try:
        payload = _decode_token(credentials.credentials)
        return int(payload["sub"])
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_optional),
) -> Optional[int]:
    """Return user_id if valid JWT present, else None (for guest access)."""
    if credentials is None:
        return None
    try:
        payload = _decode_token(credentials.credentials)
        return int(payload["sub"])
    except (ValueError, KeyError):
        return None


async def get_admin_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> int:
    """Require a valid JWT with admin role. Returns user_id.
    NOTE: Caller must ALSO verify is_admin in the database."""
    try:
        payload = _decode_token(credentials.credentials)
        user_id = int(payload["sub"])
        role = payload.get("role", "user")
        if role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        return user_id
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
