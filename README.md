# LegalLens AI

AI-powered legal information and rights-assistance platform. Initial jurisdiction: Nigeria.

**LegalLens is a legal-information and legal-literacy tool. It is not a lawyer and does not
provide legal advice.** See `docs/legal/` and `AI_SAFETY.md` for the safety architecture
that enforces this in practice.

## Status

Build following `LEGALENS_MASTER_BUILD_PLAN.md`. Current: **Phase 5 (Authentication) —
VERIFIED end-to-end, including a working frontend.**

| Phase | Status |
|---|---|
| 1. Product spec | DONE |
| 2. Architecture | DONE |
| 3. Repo init | PARTIAL — scaffold + Docker config written, `docker-compose up` not yet verified (no Docker available in the build sandbox) |
| 4. Database | VERIFIED — schema modeled, migration generated and applied against a live local Postgres 16 + pgvector, constraints tested |
| 5. Authentication | VERIFIED — register/login/refresh (with rotation)/logout/password-reset (single-use, generic-response), argon2 hashing, JWT access + revocable refresh tokens, server-side admin authorization tested with a real 403. 11 integration tests pass against a live DB. Rate limiting and email verification/delivery NOT yet implemented — see SECURITY.md |
| Web app (ahead of schedule) | VERIFIED — Next.js frontend (login/register/forgot-password/dashboard) actually builds and was integration-tested against the live API. This was previously built independently of the FastAPI backend and had never been run together — see DECISIONS.md "Frontend/backend integration audit" for the real bugs found and fixed. |
| 6+ | TODO |

See `DECISIONS.md` for what was actually tested vs. assumed.

## Local development

### Prerequisites
- Docker + Docker Compose
- Python 3.12 (for running Alembic/tests outside containers if preferred)
- Node.js 22 (for the web app)

### Setup
```bash
cp .env.example .env
# edit .env — at minimum set a real JWT_SECRET_KEY for anything beyond local dev

docker compose up -d db redis
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # includes requirements.txt + pytest/httpx
alembic upgrade head
uvicorn app.main:app --reload
```

In a second terminal, run the web app:
```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3000
```

Health check: `curl http://localhost:8000/health`

### Try the auth flow
```bash
curl -X POST localhost:8000/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-long-passphrase"}'

curl -X POST localhost:8000/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-long-passphrase"}'
# use the returned access_token as: -H "Authorization: Bearer <token>"
```

### Running tests
```bash
cd apps/api
export DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/legalens
export PYTHONPATH=$(pwd)
pytest ../../tests -v
```

### Running migrations
```bash
cd apps/api
alembic upgrade head      # apply
alembic downgrade base    # revert everything (tested — see DECISIONS.md)
alembic revision --autogenerate -m "description"   # new migration after model changes
```

## Repository structure

```
apps/api/          FastAPI backend (modular monolith)
apps/web/           Next.js frontend (not yet started)
services/            ingestion, retrieval, ai, evaluation — separable workload-shaped services
database/            migrations live in apps/api/alembic; this dir reserved for seeds
docs/                legal, architecture, security, operations documentation
tests/               unit, integration, e2e, security, evaluation
infrastructure/      docker, terraform, monitoring configs
```

## Key docs

- `PROJECT_SPEC.md` — product definition (from the master build plan)
- `ARCHITECTURE.md` — system architecture
- `DATABASE.md` — schema, constraints, and what's been tested
- `SECURITY.md` / `THREAT_MODEL.md` / `AI_SAFETY.md`
- `DECISIONS.md` — what was verified vs. assumed, and why
