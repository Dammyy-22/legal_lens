import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import JWTError, decode_supabase_token, decode_token
from app.models.enums import UserRole
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class SupabaseUser:
    id: uuid.UUID
    role: str
    email: str | None


def get_current_supabase_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> SupabaseUser:
    """Resolve a request identity from a Supabase-issued access token."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if credentials is None:
        raise unauthorized

    try:
        payload = decode_supabase_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise unauthorized

    return SupabaseUser(
        id=user_id,
        role=str(payload.get("role", "authenticated")),
        email=payload.get("email"),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolves the authenticated user from the Authorization header. Raises 401 on any
    failure — invalid token, expired token, or user no longer exists/active. Never trusts
    a client-supplied user id; the user is always looked up server-side from the token."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if credentials is None:
        raise unauthorized

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise unauthorized

    if payload.get("type") != "access":
        raise unauthorized


    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise unauthorized

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Server-side authorization check. Never rely on the frontend to hide admin UI —
    every admin-only route must depend on this, not just get_current_user."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
