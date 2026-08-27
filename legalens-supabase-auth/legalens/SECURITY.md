# Security

This document covers security controls actually implemented so far. See `THREAT_MODEL.md`
(to be written in a later phase) for the full adversarial analysis.

## Authentication (Phase 5)

- **Password storage**: argon2 via passlib. Never plaintext, never reversible.
- **Access tokens**: short-lived (30 min default) stateless JWTs, HS256-signed with
  `JWT_SECRET_KEY` (must be a real random secret in any non-local environment — see
  `.env.example`).
- **Refresh tokens**: opaque random values, not JWTs. Only a SHA-256 hash is stored (in
  `sessions.refresh_token_hash`) — SHA-256 rather than argon2 is deliberate here, since
  the input is already high-entropy random data (not a user-chosen password), so a fast
  hash is appropriate and keeps the indexed lookup on every refresh call cheap. A
  database leak alone still cannot be replayed, since only the hash is stored. Rotated
  on every use (verified: reusing a rotated-out token returns 401).
- **Authorization**: enforced server-side via `app/api/deps.py` (`get_current_user`,
  `require_admin`). The frontend is never trusted to hide unauthorized functionality —
  verified with a real request returning 403 for a non-admin user.
- **Password reset**: implemented and tested. Single-use, 1-hour-expiry token (SHA-256
  hashed at rest, same reasoning as refresh tokens), all active sessions revoked on
  successful reset, and the request endpoint returns an identical response regardless of
  whether the email is registered (verified by comparing response bodies in a test).
- **Error messages**: deliberately generic where specificity would leak information
  (login failure doesn't distinguish "no such user" from "wrong password"; logout
  doesn't reveal whether a token was valid; password-reset request doesn't reveal
  account existence).

## Known gaps as of Phase 5 (tracked, not hidden)

- **No rate limiting yet** on `/login`, `/register`, or `/password-reset/request`. This
  is a real brute-force risk and should block production deployment until Redis-backed
  rate limiting is wired in.
- **No email verification enforcement** — accounts are usable immediately after
  registration. `is_email_verified` exists in the schema for when this is implemented.
- **No email delivery** for password reset — the raw reset token is currently only
  logged server-side (see `app/api/auth.py`), not sent to the user. This must be wired
  to a real email provider before production use.
- **No account lockout / anomaly detection** on repeated failed logins.

## Secrets handling

- `JWT_SECRET_KEY` in `.env.example` is a placeholder and must be replaced with a real
  secret (`openssl rand -hex 32`) in any environment beyond local dev.
- No secrets are committed to this repository. `.env` is gitignored.
