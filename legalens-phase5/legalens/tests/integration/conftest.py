import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.db import SessionLocal
from app.main import app


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def unique_email():
    return f"test-{uuid.uuid4().hex[:12]}@example.com"
