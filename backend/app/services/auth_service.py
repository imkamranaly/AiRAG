from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.db import ensure_pool

_pwd_ctx: CryptContext | None = None


def _get_pwd_context() -> CryptContext:
    global _pwd_ctx
    if _pwd_ctx is None:
        settings = get_settings()
        _pwd_ctx = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
            bcrypt__rounds=settings.BCRYPT_ROUNDS,
            bcrypt__truncate_error=False,
        )
    return _pwd_ctx


async def register_user(email: str, password: str, full_name: str) -> dict:
    """Hash password and insert new user. Raises ValueError on duplicate email."""
    ctx = _get_pwd_context()
    password_hash = ctx.hash(password)

    pool = await ensure_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchval(
            "SELECT id FROM users WHERE email = $1",
            email.lower().strip(),
        )
        if existing:
            raise ValueError("A user with this email already exists.")

        row = await conn.fetchrow(
            """INSERT INTO users (email, password_hash, full_name)
               VALUES ($1, $2, $3)
               RETURNING id, email, full_name, created_at""",
            email.lower().strip(),
            password_hash,
            full_name.strip(),
        )
    return dict(row)


async def authenticate_user(email: str, password: str) -> dict | None:
    """Fetch user by email and verify bcrypt hash. Returns user dict or None."""
    pool = await ensure_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, full_name, password_hash, created_at FROM users WHERE email = $1",
            email.lower().strip(),
        )
    if row is None:
        return None
    ctx = _get_pwd_context()
    if not ctx.verify(password, row["password_hash"]):
        return None
    return dict(row)


def create_access_token(data: dict) -> str:
    """Create a signed JWT with an expiry claim."""
    settings = get_settings()
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload["exp"] = expire
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
