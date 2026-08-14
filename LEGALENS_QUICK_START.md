# LegalLens - QUICK START REFERENCE CARD

## ✅ What's Already Done

```
✅ Code Structure          Reviewed & verified complete
✅ Dependencies            Installed in Python venv
✅ Configuration           .env file created & secured
✅ JWT Security Key        Generated (32-byte cryptographic random)
✅ Database ORM            SQLAlchemy configured
✅ Migrations Ready        Alembic prepared (2 versions)
✅ Authentication Code     Register/login/refresh/logout implemented
✅ 11 Tests Written        Integration tests ready to run
✅ Documentation           Comprehensive guides created
```

## ❌ What You Need to Install

**1. PostgreSQL 16**
- Download: https://www.postgresql.org/download/windows/
- During install: Note the password you set for `postgres` user
- After install: `psql --version`
- Create database & extension:
  ```bash
  psql -U postgres -c "CREATE DATABASE legalens;"
  psql -U postgres -d legalens -c "CREATE EXTENSION IF NOT EXISTS vector;"
  ```

**2. Redis**
- Download: https://github.com/microsoftarchive/redis/releases (Windows release)
- OR: Use WSL: `wsl sudo apt-get install redis-server`
- After install: `redis-cli ping` (should output: PONG)

**3. (Optional) Docker**
- Download: https://www.docker.com/products/docker-desktop
- This is an alternative if you don't want local PostgreSQL/Redis

---

## 🚀 Quick Start (After Installing PostgreSQL & Redis)

### Terminal 1: Start PostgreSQL & Redis
```powershell
# PostgreSQL should start automatically after installation
# If not:
# pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start

# Redis:
redis-server
# Or if installed via chocolatey:
redis-server.exe
```

### Terminal 2: Run Database Migrations
```powershell
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\apps\api

# Activate venv
.\.venv\Scripts\Activate.ps1

# Set environment
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/legalens"
$env:PYTHONPATH = (Get-Location)

# Run migrations
alembic upgrade head

# Verify
alembic current
```

### Terminal 3: Start API Server
```powershell
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\apps\api

# Activate venv
.\.venv\Scripts\Activate.ps1

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# You should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Test in Browser or Terminal 4
```bash
# Health check
curl http://localhost:8000/health
# Expected: {"status":"ok","env":"development"}

# API Documentation
# Open browser: http://localhost:8000/docs
# Or: http://localhost:8000/redoc

# Register a user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePassword123!"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePassword123!"}'
```

---

## 📄 Key Files Reference

| Purpose | File | Status |
|---------|------|--------|
| Setup Guide | `LEGALENS_LOCAL_SETUP_GUIDE.md` | ✅ [NEW] |
| Project Review | `LEGALENS_PROJECT_REVIEW.md` | ✅ [NEW] |
| Architecture | `LEGALENS_ARCHITECTURE_DIAGRAM.md` | ✅ [NEW] |
| This Guide | `LEGALENS_QUICK_START.md` | ✅ [NEW] |
| Product Spec | `legalens-phase5/legalens/PROJECT_SPEC.md` | ✅ Original |
| System Design | `legalens-phase5/legalens/ARCHITECTURE.md` | ✅ Original |
| Security | `legalens-phase5/legalens/SECURITY.md` | ✅ Original |
| Database | `legalens-phase5/legalens/DATABASE.md` | ✅ Original |
| Decisions | `legalens-phase5/legalens/DECISIONS.md` | ✅ Original |

---

## 🔧 Environment Variables (Already Configured in .env)

```env
APP_NAME=legalens-api
APP_ENV=development
APP_DEBUG=true

# Database (localhost for local dev)
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/legalens

# Cache
REDIS_URL=redis://localhost:6379/0

# Security (generated securely)
JWT_SECRET_KEY=24346f158401e9f5fa3f482a75a553d340124ff8c81a832299a94d356d272ea8
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=14

# Embeddings (for Phase 8)
EMBEDDING_DIM=1536
```

---

## 📊 API Endpoints (Phase 5 - Authentication Ready)

### Health Check
```
GET /health
Response: 200 OK
{"status":"ok","env":"development"}
```

### Register
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response: 200 OK
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "created_at": "2026-08-14T10:30:00.000Z"
}
```

### Login
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response: 200 OK
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}

# Use access_token in header:
Authorization: Bearer <access_token>
```

### Refresh Token
```
POST /api/v1/auth/refresh
Authorization: Bearer <refresh_token>

Response: 200 OK
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

### Logout
```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>

Response: 200 OK
{"message":"Logged out successfully"}
```

### Password Reset - Request
```
POST /api/v1/auth/password-reset/request
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: 200 OK
{"message":"If email exists, reset link has been sent"}
```

### Password Reset - Confirm
```
POST /api/v1/auth/password-reset/confirm
Content-Type: application/json

{
  "email": "user@example.com",
  "reset_token": "<single-use token from email>",
  "new_password": "NewSecurePassword123!"
}

Response: 200 OK
{"message":"Password reset successfully"}
```

---

## 🧪 Running Tests

```powershell
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\apps\api

# Activate venv
.\.venv\Scripts\Activate.ps1

# Set environment
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/legalens"
$env:PYTHONPATH = (Get-Location)

# Run all tests
pytest ../../tests -v

# Run only auth tests
pytest ../../tests/integration/test_auth.py -v

# Run specific test
pytest ../../tests/integration/test_auth.py::test_register -v

# With coverage
pytest ../../tests --cov=app ../../tests -v
```

---

## 🐳 Alternative: Docker Setup (If you prefer)

```powershell
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens

# Start all services (PostgreSQL, Redis, API)
docker compose up -d

# Watch logs
docker compose logs -f api

# Test
curl http://localhost:8000/health

# Stop services
docker compose down
```

---

## 🆘 Troubleshooting

### Error: "psycopg" connection refused
**Problem:** PostgreSQL not running
```powershell
# Check if running
Get-Process postgres

# Start PostgreSQL
pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start
```

### Error: "pgvector" extension not found
**Problem:** Extension not created
```bash
psql -U postgres -d legalens -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Error: "Redis connection refused"
**Problem:** Redis not running
```powershell
redis-cli ping
# If not PONG, start redis-server
redis-server
```

### Error: "JWT_SECRET_KEY not set"
**Problem:** .env not loaded
```powershell
# Verify .env exists
Get-Content .env | Select-String JWT_SECRET_KEY
```

### Tests fail with DB errors
```powershell
# Ensure migrations are applied
alembic upgrade head

# Check current migration
alembic current

# Reset to base (careful!)
alembic downgrade base
alembic upgrade head
```

---

## 📈 What's Next After Getting It Running

1. **Try the Auth Flow**
   - Register a user
   - Login and get tokens
   - Use access_token to call other endpoints
   - Refresh the token
   - Logout

2. **Run the Tests**
   - pytest ../../tests/integration/test_auth.py -v
   - Verify all 11 tests pass

3. **Check API Documentation**
   - Open http://localhost:8000/docs in browser
   - Interactive Swagger UI for testing endpoints

4. **Explore the Code**
   - apps/api/app/main.py (main FastAPI app)
   - apps/api/app/api/auth.py (auth endpoints)
   - apps/api/app/models/ (database models)
   - apps/api/app/core/security.py (JWT & password logic)

5. **Prepare for Phase 6** (Document Upload)
   - S3/object storage setup
   - Document ingestion service

---

## 📞 Important Contacts

- **Project Root:** `c:\Users\hp\Documents\legal_lens\`
- **Phase 5 Code:** `c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\`
- **API Code:** `c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\apps\api\`
- **Tests:** `c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\tests\`

---

## ⚡ One-Liner Setup (After PostgreSQL & Redis Installed)

```powershell
cd legalens-phase5\legalens\apps\api; .\.venv\Scripts\Activate.ps1; alembic upgrade head; uvicorn app.main:app --reload
```

Then test: `curl http://localhost:8000/health`

---

**Status:** 🟢 **READY TO RUN** (Just install PostgreSQL & Redis)  
**Last Updated:** 2026-08-14  
**Setup Complexity:** Medium (2 external services to install)  
**Estimated Time:** 15 minutes (including PostgreSQL download & install)

---

## 📚 Documentation Map

```
c:\Users\hp\Documents\legal_lens\
│
├─ LEGALENS_QUICK_START.md ← You are here
├─ LEGALENS_LOCAL_SETUP_GUIDE.md ← Detailed instructions
├─ LEGALENS_PROJECT_REVIEW.md ← Complete review & status
├─ LEGALENS_ARCHITECTURE_DIAGRAM.md ← Visual architecture
│
└─ legalens-phase5\legalens\
   ├─ README.md
   ├─ PROJECT_SPEC.md
   ├─ ARCHITECTURE.md
   ├─ DATABASE.md
   ├─ SECURITY.md
   ├─ DECISIONS.md
   │
   └─ apps\api\
      ├─ requirements.txt
      ├─ .env (generated with your JWT secret)
      ├─ alembic\ (migrations ready to run)
      └─ app\ (FastAPI code)
```

**Everything is documented. Everything is ready. Just install the databases! 🚀**
