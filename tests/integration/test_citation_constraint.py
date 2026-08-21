"""
Integration test locking in the core safety invariant: a citation row can never exist
without pointing to a real retrieved chunk (authoritative or user-document).

Requires a live Postgres (DATABASE_URL env var) with migrations applied. This is the
kind of test that should run in CI against a docker-compose Postgres service, not
against a mocked DB — the guarantee we care about is enforced by the database itself.
"""
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.db import SessionLocal


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _make_user_and_message(db):
    user_id = uuid.uuid4()
    db.execute(
        text(
            "INSERT INTO users (id, email, hashed_password, role, is_active, is_email_verified) "
            "VALUES (:id, :email, 'x', 'user', true, false)"
        ),
        {"id": user_id, "email": f"{user_id}@example.com"},
    )
    conv_id = uuid.uuid4()
    db.execute(
        text("INSERT INTO conversations (id, user_id, jurisdiction) VALUES (:id, :uid, 'Nigeria')"),
        {"id": conv_id, "uid": user_id},
    )
    msg_id = uuid.uuid4()
    db.execute(
        text(
            "INSERT INTO messages (id, conversation_id, role, content, risk_level, is_uncertain) "
            "VALUES (:id, :cid, 'user', 'test', 'standard', false)"
        ),
        {"id": msg_id, "cid": conv_id},
    )
    db.flush()
    return msg_id


def test_citation_requires_exactly_one_source(db):
    msg_id = _make_user_and_message(db)

    # Both source columns NULL must be rejected.
    with pytest.raises(IntegrityError):
        db.execute(
            text("INSERT INTO citations (id, message_id) VALUES (:id, :mid)"),
            {"id": uuid.uuid4(), "mid": msg_id},
        )
        db.flush()
