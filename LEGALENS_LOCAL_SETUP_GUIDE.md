# LegalLens Local Development Setup Guide

## Project Overview
**LegalLens** is an AI-powered legal information system for Nigeria. The project is in **Phase 5 (Authentication)** with verified auth implementation and database schema.

### Current Status
- ✅ API structure and dependencies installed
- ✅ Authentication system implemented (register, login, refresh, logout, password reset)
- ✅ Database schema modeled (PostgreSQL 16 + pgvector)
- ✅ 11 integration tests verified
- ❌ PostgreSQL database not installed locally
- ❌ Redis cache not installed locally
- ❌ Docker not available

---

## Architecture

```
legalens-phase5/legalens/
├── apps/
│   ├── api/           # FastAPI backend (Python)
│   │   ├── app/
│   │   │   ├── main.py           # FastAPI app
│   │   │   ├── api/auth.py       # Auth endpoints
│   │   │   ├── core/
│   │   │   │   ├── config.py     # Settings from .env
│   │   │   │   ├── db.py         # Database engine
│   │   │   │   └── security.py   # JWT/Argon2
│   │   │   └── models/           # SQLAlchemy ORM
│   │   └── alembic/              # Database migrations
│   └── web/           # Next.js frontend (not started)
├── services/          # Separable workloads (AI, evaluation, ingestion, retrieval)
├── tests/             # Unit, integration, e2e, security
├── docs/              # Architecture, security, legal
├── infrastructure/    # Docker, terraform, monitoring
└── database/          # Seeds and migration planning
```

---

## Prerequisites Required

### 1. **PostgreSQL 16 with pgvector extension**
   - Download: https://www.postgresql.org/download/windows/
   - Verify: `psql --version`
   - Post-install: 
     ```bash
     # Connect to postgres and create extension
     psql -U postgres -d legalens -c "CREATE EXTENSION IF NOT EXISTS vector;"
     ```

### 2. **Redis** (for session/cache management)
   - Windows option: https://github.com/microsoftarchive/redis/releases
   - Or use WSL: `wsl sudo apt-get install redis-server`
   - Verify: `redis-cli ping` (should return `PONG`)

### 3. **Python 3.12+**
   - ✅ Already available: Python 3.14.0

### 4. **Docker & Docker Compose** (optional, for containerized setup)
   - Alternative to local PostgreSQL/Redis
   - Download: https://www.docker.com/products/docker-desktop

---

## Setup Instructions (Local PostgreSQL + Redis)

### Step 1: Install PostgreSQL 16
```powershell
# After installation, verify
psql --version

# Create the legalens database and extension
psql -U postgres -c "CREATE DATABASE legalens;"
psql -U postgres -d legalens -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Step 2: Install Redis
```powershell
# Via Windows Redis release or WSL
redis-cli ping
# Expected output: PONG
```

### Step 3: Configure Environment
```powershell
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens

# .env already configured with:
# - DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/legalens
# - REDIS_URL=redis://localhost:6379/0
# - JWT_SECRET_KEY=<generated>

# Verify:
Get-Content .env | Select-String -Pattern "DATABASE_URL|REDIS_URL|JWT_SECRET_KEY"
```

### Step 4: Set Up Python Virtual Environment
```powershell
cd apps/api

# Create venv
python -m venv .venv

# Activate (PowerShell)
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements-dev.txt
```

### Step 5: Run Database Migrations
```powershell
cd apps/api

# Activate venv if not already
.\.venv\Scripts\Activate.ps1

# Set environment variables
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/legalens"
$env:PYTHONPATH = (Get-Location)

# Apply migrations
alembic upgrade head

# Verify migration
alembic current
```

### Step 6: Start the API Server
```powershell
cd apps/api

# Activate venv
.\.venv\Scripts\Activate.ps1

# Run with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 7: Verify API is Running
```powershell
# In a new terminal
curl http://localhost:8000/health
# Expected: {"status":"ok","env":"development"}
```

---

## API Endpoints (Phase 5)

### Health Check
```bash
GET http://localhost:8000/health
```

### Authentication
```bash
# Register
POST http://localhost:8000/api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

# Login
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
# Returns: {"access_token": "...", "refresh_token": "...", ...}

# Refresh Token
POST http://localhost:8000/api/v1/auth/refresh
Authorization: Bearer <refresh_token>

# Logout
POST http://localhost:8000/api/v1/auth/logout
Authorization: Bearer <access_token>

# Password Reset (request)
POST http://localhost:8000/api/v1/auth/password-reset/request
Content-Type: application/json

{
  "email": "user@example.com"
}

# Password Reset (confirm)
POST http://localhost:8000/api/v1/auth/password-reset/confirm
Content-Type: application/json

{
  "email": "user@example.com",
  "reset_token": "...",
  "new_password": "NewSecurePassword123!"
}
```

---

## Running Tests

```powershell
cd apps/api

# Activate venv
.\.venv\Scripts\Activate.ps1

# Set environment
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/legalens"
$env:PYTHONPATH = (Get-Location)

# Run all tests
pytest ../../tests -v

# Run only integration tests
pytest ../../tests/integration -v

# Run specific test
pytest ../../tests/integration/test_auth.py::test_register -v
```

---

## Using Docker (Alternative to Local Setup)

If you prefer containerized setup, install Docker Desktop and run:

```powershell
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens

# Start services (db, redis, api)
docker compose up -d

# Check logs
docker compose logs -f api

# Stop services
docker compose down
```

The `docker-compose.yml` includes:
- PostgreSQL 16 + pgvector
- Redis 7-alpine
- FastAPI container with hot-reload

---

## Next Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1-4 | ✅ DONE | Product spec, architecture, repo, database |
| 5 | ✅ VERIFIED | Authentication (current) |
| 6-7 | 📋 TODO | Ingestion service, document upload, storage |
| 8-10 | 📋 TODO | RAG pipeline, embeddings, AI provider, retrieval |
| 11-12 | 📋 TODO | Assistant, legal search, source explorer |
| 13 | 📋 TODO | Rights explorer |
| 14-16 | 📋 TODO | Conversation history, admin console, evaluation |

---

## Troubleshooting

### "psycopg" connection error
- PostgreSQL not running: `pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start`
- Wrong credentials: Update DATABASE_URL in .env
- Database doesn't exist: `psql -U postgres -c "CREATE DATABASE legalens;"`

### "pgvector extension not found"
- Connect to database: `psql -U postgres -d legalens`
- Install extension: `CREATE EXTENSION IF NOT EXISTS vector;`

### Redis connection error
- Redis not running: Start redis-server
- Wrong URL: Verify REDIS_URL in .env

### Alembic migration errors
- Database clean state: `alembic downgrade base` then `alembic upgrade head`
- Generate new migration: `alembic revision --autogenerate -m "description"`

### Tests failing
- Ensure PostgreSQL is running
- Check DATABASE_URL environment variable is set
- Migrations are applied: `alembic upgrade head`

---

## Files Modified/Created

✅ **Created/Fixed:**
- `.env` - Configuration file (from .env.example)
- `apps/api/requirements-dev.txt` - Fixed duplicate dependency versions
- `apps/api/.venv/` - Python virtual environment

✅ **Configuration Complete:**
- JWT_SECRET_KEY generated and set
- Database URL configured for localhost
- Redis URL configured for localhost

---

## Quick Start Checklist

- [ ] Install PostgreSQL 16 + pgvector extension
- [ ] Install Redis
- [ ] Set DATABASE_URL and REDIS_URL environment variables
- [ ] Run `alembic upgrade head` for database schema
- [ ] Run `uvicorn app.main:app --reload` to start API
- [ ] Test `curl http://localhost:8000/health`
- [ ] Try auth endpoints (register, login)
- [ ] Run tests: `pytest ../../tests/integration -v`

---

**For detailed architecture and design decisions, see `DECISIONS.md`, `ARCHITECTURE.md`, and `SECURITY.md` in the project root.**
