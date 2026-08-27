from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    try:
        user = auth_service.register_user(
            db, email=payload.email, password=payload.password, full_name=payload.full_name
        )
        db.commit()
    except auth_service.EmailAlreadyRegistered:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = auth_service.authenticate_user(db, email=payload.email, password=payload.password)
    except auth_service.InvalidCredentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    except auth_service.AccountInactive:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    access_token, refresh_token = auth_service.issue_tokens(
        db,
        user=user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        access_token, refresh_token = auth_service.refresh_access_token(
            db, refresh_token=payload.refresh_token
        )
    except (auth_service.InvalidRefreshToken, auth_service.AccountInactive):
        db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    db.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> None:
    auth_service.revoke_refresh_token(db, refresh_token=payload.refresh_token)
    db.commit()


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def password_reset_request(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> dict:
    """Always returns the same generic 202 whether or not the email exists — the
    response shape must never leak account existence. The raw reset token itself is
    logged here rather than emailed, since no email-delivery integration exists yet
    (flagged in DECISIONS.md as a known gap for this phase)."""
    token = auth_service.request_password_reset(db, email=payload.email)
    db.commit()
    if token is not None:
        # TODO(Phase 16 / notifications): send via email instead of returning/logging.
        # Deliberately not returned in the response body — only logged server-side for
        # now, so this endpoint's behavior doesn't differ based on account existence.
        import logging

        logging.getLogger("legalens.auth").info("password_reset_token_issued", extra={"user_email_domain": payload.email.split("@")[-1]})
    return {"detail": "If that email is registered, a password reset link has been issued."}


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
def password_reset_confirm(payload: PasswordResetConfirm, db: Session = Depends(get_db)) -> None:
    try:
        auth_service.confirm_password_reset(db, token=payload.token, new_password=payload.new_password)
    except (auth_service.InvalidRefreshToken, auth_service.AccountInactive):
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    db.commit()


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
