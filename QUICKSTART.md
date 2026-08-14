# 🚀 LegalLens - Start Here

Welcome! LegalLens is an AI-powered legal information platform for Nigeria. This guide will help you get started locally and deploy to production.

## 📋 What You Have

```
legalens-phase5/legalens/
├── apps/
│   ├── api/           ← FastAPI backend (Python, SQLAlchemy, PostgreSQL)
│   └── web/           ← Next.js frontend (React, TypeScript, Tailwind CSS)
├── database/          ← PostgreSQL schemas and migrations
├── services/          ← AI, retrieval, ingestion, evaluation services
├── docs/              ← Architecture and security documentation
└── tests/             ← Integration, unit, e2e, security tests
```

## 🔧 Quick Start (Local Development)

### 1️⃣ Prerequisites

- **Python 3.10+** - For backend
- **Node.js 18+** - For frontend
- **PostgreSQL 16** - For database (or use Supabase)
- **Git** - For version control

### 2️⃣ Backend Setup

```bash
cd legalens-phase5/legalens/apps/api

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Set up environment
# Copy .env.example to .env and update with your Supabase credentials
# Key variables:
# - DATABASE_URL=postgresql://user:password@localhost:5432/legalens
# - JWT_SECRET_KEY=<generated 32-byte random string>
# - REDIS_URL=redis://localhost:6379

# Run migrations (if using local PostgreSQL)
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server will start at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### 3️⃣ Frontend Setup

```bash
cd legalens-phase5/legalens/apps/web

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Update .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Start development server
npm run dev
```

Frontend will start at: `http://localhost:3000`

### 4️⃣ Test Locally

Open `http://localhost:3000` in your browser:

1. Go to **Register** or **Login**
2. Create account: `test@example.com` / `TestPassword123!`
3. Login and explore dashboard
4. Check backend logs for API calls

## 🌐 Deploy to Production

### Backend Deployment (FastAPI)

**Option A: Railway.app** (Recommended)

```bash
# Create Railway account at railway.app
# Install Railway CLI: npm install -g @railway/cli
# Login: railway login
# In api/ folder:
railway init
railway link  # Select your project
railway up    # Deploy
```

**Option B: Render.com**

```bash
# Create Render account at render.com
# Connect GitHub repo
# New → Web Service → Deploy
# Set start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
# Set environment variables from .env
```

### Database Setup (Supabase)

1. Go to `https://app.supabase.com`
2. Create project or use existing one
3. Get credentials from **Settings → API**:
   - Project URL → `SUPABASE_URL`
   - Anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`
4. Run migrations:
   ```bash
   cd legalens-phase5/legalens/apps/api
   export DATABASE_URL="your-supabase-connection-string"
   alembic upgrade head
   ```

### Frontend Deployment (Vercel)

1. Push frontend code to GitHub
2. Go to `https://vercel.com`
3. Import repo: **Add New → Project → Import Git**
4. Set **Root Directory**: `legalens-phase5/legalens/apps/web`
5. Add environment variables:
   - `NEXT_PUBLIC_API_URL` → Your backend URL (e.g., `https://api-xyz.railway.app`)
   - `NEXT_PUBLIC_SUPABASE_URL` → Your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Your Supabase anon key
6. Click **Deploy**

## 📝 Environment Variables

### Backend (`apps/api/.env`)

```env
# Database
DATABASE_URL=postgresql+psycopg://user:password@host:5432/legalens

# JWT
JWT_SECRET_KEY=<32-byte random string>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Redis (for rate limiting, caching)
REDIS_URL=redis://localhost:6379

# CORS (for frontend domains)
CORS_ORIGINS=["http://localhost:3000","https://*.vercel.app"]

# Embeddings
EMBEDDING_DIM=1536
```

### Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

## 🧪 Testing

### Run Integration Tests

```bash
cd apps/api
source .venv/bin/activate  # or .venv\Scripts\Activate.ps1 on Windows
export DATABASE_URL="postgresql+psycopg://user:password@localhost:5432/legalens"
pytest tests/integration -v
```

Current status: **✅ 11 integration tests passing** (auth endpoints)

## 🔐 Security Notes

- JWT tokens expire in 24 hours
- Passwords hashed with Argon2-cffi
- CORS configured for specific domains (not `*`)
- Password reset uses single-use tokens
- All sensitive data in environment variables (never committed)

## 📚 Documentation

- [LEGALENS_PROJECT_REVIEW.md](./LEGALENS_PROJECT_REVIEW.md) - Full project analysis
- [DEPLOYMENT_GUIDE_SUPABASE_VERCEL.md](./DEPLOYMENT_GUIDE_SUPABASE_VERCEL.md) - Detailed deployment steps
- [LEGALENS_ARCHITECTURE_DIAGRAM.md](./LEGALENS_ARCHITECTURE_DIAGRAM.md) - System architecture
- [legalens-phase5/legalens/PROJECT_SPEC.md](./legalens-phase5/legalens/PROJECT_SPEC.md) - Project specification
- [legalens-phase5/legalens/DATABASE.md](./legalens-phase5/legalens/DATABASE.md) - Database schema

## 🐛 Troubleshooting

### Frontend won't connect to backend
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Ensure backend is running on correct port
- Check CORS configuration in `apps/api/app/main.py`

### Database connection fails
- Verify `DATABASE_URL` format
- Check PostgreSQL/Supabase is running
- Test connection: `psql <DATABASE_URL>`

### Venv activation fails
- Windows: `.\.venv\Scripts\Activate.ps1`
- Mac/Linux: `source .venv/bin/activate`
- If permission denied: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

## 🚀 Next Steps

1. ✅ Clone/download project
2. ✅ Set up backend (.venv, dependencies, .env)
3. ✅ Set up frontend (npm install, .env.local)
4. ✅ Start local development (backend on 8000, frontend on 3000)
5. ✅ Test authentication locally
6. ✅ Set up Supabase project
7. ✅ Deploy backend to Railway/Render
8. ✅ Deploy frontend to Vercel
9. ✅ Configure production environment variables
10. ✅ Test production deployment

## 💡 Need Help?

- Check the detailed guides in `docs/`
- Review test files in `tests/integration/`
- Check FastAPI docs at `/docs` endpoint
- Review error logs in terminal/console

---

**LegalLens** - Understanding the law, powered by AI 🤖⚖️

*Built for Nigeria. Free and open.*
