import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt
from jose.exceptions import JWTError

from app.api.deps import get_current_supabase_user
from app.core.config import settings
from app.core.security import decode_supabase_token


def make_token(**claims: object) -> str:
    payload = {
        "sub": str(uuid.uuid4()),
        "aud": settings.SUPABASE_JWT_AUDIENCE,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "role": "authenticated",
        "email": "user@example.com",
        **claims,
    }
    return jwt.encode(payload, "test-supabase-secret", algorithm="HS256")


def test_supabase_token_requires_configuration(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", None)

    with pytest.raises(JWTError):
        decode_supabase_token(make_token())


def test_supabase_token_rejects_wrong_audience(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "test-supabase-secret")

    with pytest.raises(JWTError):
        decode_supabase_token(make_token(aud="not-legalens"))


def test_supabase_dependency_returns_verified_identity(monkeypatch):
    user_id = uuid.uuid4()
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "test-supabase-secret")
    token = make_token(sub=str(user_id))

    user = get_current_supabase_user(
        credentials=type("Credentials", (), {"credentials": token})()
    )

    assert user.id == user_id
    assert user.role == "authenticated"
    assert user.email == "user@example.com"