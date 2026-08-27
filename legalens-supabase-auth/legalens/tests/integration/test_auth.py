"""
End-to-end auth flow tests against a live Postgres (via FastAPI TestClient, real DB
sessions — no mocking of the DB layer, since the whole point is verifying server-side
enforcement).
"""
from app.services import auth_service

STRONG_PASSWORD = "Correct-Horse-9"


def test_register_login_me_flow(client, unique_email):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": STRONG_PASSWORD, "full_name": "Test User"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == unique_email
    assert body["role"] == "user"
    assert "hashed_password" not in body  # never leak the hash

    r = client.post("/api/v1/auth/login", json={"email": unique_email, "password": STRONG_PASSWORD})
    assert r.status_code == 200, r.text
    tokens = r.json()
    assert tokens["token_type"] == "bearer"
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == unique_email

    # refresh rotates the token and the old refresh token becomes unusable
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200, r.text
    new_tokens = r.json()
    assert new_tokens["refresh_token"] != refresh_token

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 401, "old refresh token must not be reusable after rotation"


def test_duplicate_registration_rejected(client, unique_email):
    payload = {"email": unique_email, "password": STRONG_PASSWORD}
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201
    r2 = client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409


def test_wrong_password_rejected(client, unique_email):
    client.post("/api/v1/auth/register", json={"email": unique_email, "password": STRONG_PASSWORD})
    r = client.post("/api/v1/auth/login", json={"email": unique_email, "password": "totally-wrong-1"})
    assert r.status_code == 401


def test_me_without_token_rejected(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_me_with_garbage_token_rejected(client):
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


def test_logout_revokes_refresh_token(client, unique_email):
    client.post("/api/v1/auth/register", json={"email": unique_email, "password": STRONG_PASSWORD})
    r = client.post("/api/v1/auth/login", json={"email": unique_email, "password": STRONG_PASSWORD})
    refresh_token = r.json()["refresh_token"]

    r = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert r.status_code == 204

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 401, "revoked refresh token must not work"


def test_password_reset_flow(client, db, unique_email):
    client.post("/api/v1/auth/register", json={"email": unique_email, "password": STRONG_PASSWORD})

    # Exercise the request endpoint for its externally-visible behavior (generic 202
    # regardless of outcome — must not leak account existence).
    r = client.post("/api/v1/auth/password-reset/request", json={"email": unique_email})
    assert r.status_code == 202
    r_unknown = client.post("/api/v1/auth/password-reset/request", json={"email": "nobody-here@example.com"})
    assert r_unknown.status_code == 202
    assert r.json() == r_unknown.json(), "response body must not differ based on account existence"

    # Get the actual raw token via the service layer directly (the HTTP layer never
    # returns it, by design — see app/api/auth.py).
    token = auth_service.request_password_reset(db, email=unique_email)
    db.commit()
    assert token is not None

    new_password = "New-Correct-7"
    r = client.post(
        "/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": new_password}
    )
    assert r.status_code == 204, r.text

    # old password no longer works, new one does
    r = client.post("/api/v1/auth/login", json={"email": unique_email, "password": STRONG_PASSWORD})
    assert r.status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": unique_email, "password": new_password})
    assert r.status_code == 200


def test_password_reset_token_single_use(client, db, unique_email):
    client.post("/api/v1/auth/register", json={"email": unique_email, "password": STRONG_PASSWORD})
    token = auth_service.request_password_reset(db, email=unique_email)
    db.commit()

    r1 = client.post(
        "/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": "First-New-7"}
    )
    assert r1.status_code == 204

    r2 = client.post(
        "/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": "Second-New-7"}
    )
    assert r2.status_code == 400, "a used reset token must not be reusable"


def test_weak_password_rejected_at_registration(client, unique_email):
    r = client.post("/api/v1/auth/register", json={"email": unique_email, "password": "alllettersnodigit"})
    assert r.status_code == 422


def test_require_admin_blocks_regular_user(client, db, unique_email):
    """Verifies server-side authorization is actually enforced, not just present in
    code — a regular user's valid token must be rejected by an admin-only dependency."""
    from fastapi import Depends, FastAPI
    from fastapi.testclient import TestClient

    from app.api.deps import require_admin

    client.post("/api/v1/auth/register", json={"email": unique_email, "password": STRONG_PASSWORD})
    login = client.post("/api/v1/auth/login", json={"email": unique_email, "password": STRONG_PASSWORD})
    access_token = login.json()["access_token"]

    # Minimal throwaway app exercising the real require_admin dependency against a real
    # non-admin user + real token, rather than asserting on code shape.
    probe_app = FastAPI()

    @probe_app.get("/admin-only")
    def admin_only(user=Depends(require_admin)):
        return {"ok": True}

    probe_client = TestClient(probe_app)
    r = probe_client.get("/admin-only", headers={"Authorization": f"Bearer {access_token}"})
    assert r.status_code == 403
