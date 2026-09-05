"""
Password hashing and JWT utilities.

Password hashing: argon2 via passlib (memory-hard, resistant to GPU cracking — preferred
over bcrypt for new systems per current OWASP guidance).

Tokens: short-lived JWT access tokens (stateless, not revocable before expiry — kept
short for that reason) + opaque refresh tokens stored server-side as a hash in
`sessions.refresh_token_hash` (revocable, rotated on use).
"""
import hashlib
import json
import secrets
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwk, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    """Stateless JWT. Payload deliberately minimal — no email or other PII, per
    build-plan §19 (never put sensitive data in JWT payloads)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Raises jose.JWTError on any invalid/expired/malformed token — callers (see
    app/api/deps.py) catch that and translate to a 401."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def decode_supabase_token(token: str) -> dict:
    """Verify a Supabase Auth access token and return its claims."""
    options = {"verify_aud": True, "verify_iss": bool(settings.SUPABASE_JWT_ISSUER)}
    issuer_args = {"issuer": settings.SUPABASE_JWT_ISSUER} if settings.SUPABASE_JWT_ISSUER else {}

    if settings.SUPABASE_JWKS_URL:
        header = jwt.get_unverified_header(token)
        with urllib.request.urlopen(settings.SUPABASE_JWKS_URL, timeout=5) as response:
            keys = json.load(response).get("keys", [])
        key_data = next((key for key in keys if key.get("kid") == header.get("kid")), None)
        if key_data is None:
            raise JWTError("Supabase signing key not found")
        key = jwk.construct(key_data)
        return jwt.decode(
            token,
            key,
            algorithms=[header.get("alg", "RS256")],
            audience=settings.SUPABASE_JWT_AUDIENCE,
            options=options,
            **issuer_args,
        )

    if not settings.SUPABASE_JWT_SECRET:
        raise JWTError("Supabase JWT verification is not configured")
    return jwt.decode(
        token,
        settings.SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        audience=settings.SUPABASE_JWT_AUDIENCE,
        options=options,
        **issuer_args,
    )


def generate_refresh_token() -> str:
    """Opaque, high-entropy token. Only its hash is ever stored — the raw value is
    returned to the client once and cannot be recovered from the DB."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """SHA-256 is fine here (not a password — already high-entropy random data), and is
    fast, which matters for the refresh-token lookup path on every refresh call. Reused
    for password-reset tokens too — same properties apply."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(32)


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_token",
    "generate_refresh_token",
    "hash_refresh_token",
    "generate_password_reset_token",
    "JWTError",
]
