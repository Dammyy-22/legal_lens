"""
Auth service. All authentication/session logic lives here — the API layer
(app/api/auth.py) stays thin and only handles HTTP concerns.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_password_reset_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.user import PasswordResetToken, User, UserSession


class AuthError(Exception):
    """Base class for auth failures the API layer translates into HTTP responses."""


class EmailAlreadyRegistered(AuthError):
    pass


class InvalidCredentials(AuthError):
    pass


class InvalidRefreshToken(AuthError):
    pass


class AccountInactive(AuthError):
    pass


def register_user(db: Session, *, email: str, password: str, full_name: str | None) -> User:
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing is not None:
        # Deliberately generic — LegalLens MVP favors clear registration-time UX over
        # hiding account existence at this specific step (a documented trade-off, not
        # an oversight; login/reset flows below DO avoid leaking existence).
        raise EmailAlreadyRegistered()

    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
    )
    db.add(user)
    db.flush()
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        # Same error for "no such user" and "wrong password" — do not leak which.
        raise InvalidCredentials()
    if not user.is_active:
        raise AccountInactive()
    return user


def issue_tokens(db: Session, *, user: User, user_agent: str | None, ip_address: str | None) -> tuple[str, str]:
    access_token = create_access_token(user_id=user.id, role=user.role.value)

    refresh_token = generate_refresh_token()
    session = UserSession(
        id=uuid.uuid4(),
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.flush()
    return access_token, refresh_token


def _get_live_session_by_token(db: Session, refresh_token: str) -> UserSession | None:
    """Direct indexed lookup by hash — O(1) via the unique index on refresh_token_hash,
    not a scan-and-verify over every active session."""
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(refresh_token)
    return db.execute(
        select(UserSession).where(
            UserSession.refresh_token_hash == token_hash,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    ).scalar_one_or_none()


def refresh_access_token(db: Session, *, refresh_token: str) -> tuple[str, str]:
    """Validates the refresh token, rotates it (old session revoked, new one issued),
    and returns a fresh (access_token, refresh_token) pair. Rotation limits the damage
    window if a refresh token is ever stolen."""
    matched = _get_live_session_by_token(db, refresh_token)
    if matched is None:
        raise InvalidRefreshToken()

    user = db.get(User, matched.user_id)
    if user is None or not user.is_active:
        raise AccountInactive()

    matched.revoked_at = datetime.now(timezone.utc)
    db.flush()

    return issue_tokens(db, user=user, user_agent=matched.user_agent, ip_address=matched.ip_address)


def revoke_refresh_token(db: Session, *, refresh_token: str) -> None:
    """Used for logout. Silently no-ops if the token doesn't match anything live —
    logout should not leak whether a token was valid."""
    matched = _get_live_session_by_token(db, refresh_token)
    if matched is not None:
        matched.revoked_at = datetime.now(timezone.utc)
        db.flush()


def request_password_reset(db: Session, *, email: str) -> str | None:
    """Returns the raw reset token if the user exists, else None. Callers MUST treat
    both outcomes identically at the HTTP layer (always return a generic 202) — do not
    let this function's return value change the response shape, or account existence
    leaks via timing/response differences."""
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        return None

    token = generate_password_reset_token()
    reset = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(token),  # same sha256 scheme; it's a random token, not a password
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset)
    db.flush()
    return token


def confirm_password_reset(db: Session, *, token: str, new_password: str) -> None:
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(token)
    reset = db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    ).scalar_one_or_none()

    if reset is None:
        raise InvalidRefreshToken()  # reused as a generic "invalid/expired token" error

    user = db.get(User, reset.user_id)
    if user is None or not user.is_active:
        raise AccountInactive()

    user.hashed_password = hash_password(new_password)
    reset.used_at = now

    # Reset all existing sessions on password change — a leaked password shouldn't
    # leave old sessions valid after the user has secured their account.
    live_sessions = db.execute(
        select(UserSession).where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
    ).scalars().all()
    for s in live_sessions:
        s.revoked_at = now

    db.flush()
