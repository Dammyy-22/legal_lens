# LegalLens - Supabase + Vercel Deployment Guide

## 🎯 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEGALENS PRODUCTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Frontend Layer                                                   │
│  ┌──────────────────────────────────────┐                       │
│  │  Vercel (Next.js)                    │                       │
│  │  https://yourapp.vercel.app          │                       │
│  │                                      │                       │
│  │  • User Interface                    │                       │
│  │  • Authentication flows              │                       │
│  │  • API calls to backend              │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             │ HTTPS REST API                                    │
│             ↓                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │  Backend Layer                       │                       │
│  │                                      │                       │
│  │  FastAPI (Python)                    │                       │
│  │  Running on: Supabase / Railway      │                       │
│  │                                      │                       │
│  │  • Authentication endpoints          │                       │
│  │  • Legal search & assistant          │                       │
│  │  • Document handling                 │                       │
│  │  • Admin operations                  │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ↓                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │  Supabase (Backend Services)         │                       │
│  │                                      │                       │
│  │  • PostgreSQL 16 + pgvector          │                       │
│  │  • Authentication (JWT)              │                       │
│  │  • Real-time subscriptions           │                       │
│  │  • Storage for documents             │                       │
│  └──────────────────────────────────────┘                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ STEP 1: Configure FastAPI Backend for CORS (Supabase)

Update the FastAPI app to accept requests from your frontend:

**File:** `apps/api/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)

# CORS configuration for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://yourapp.vercel.app",  # Production Vercel domain
        "https://yourdomain.com",  # Custom domain (if any)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/health")
def health() -> dict:
    """Liveness/readiness probe."""
    return {"status": "ok", "env": settings.APP_ENV}
```

---

## ✅ STEP 2: Initialize Next.js Frontend

The `apps/web/` folder is empty. Let's create a complete Next.js app:

```bash
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\apps\web

# Initialize Next.js with TypeScript
npx create-next-app@latest . --typescript --tailwind --app --no-git

# Or manually:
npm create next-app@latest . --typescript --tailwind
```

**Or create the structure manually:**

```powershell
# In apps/web/
mkdir -p app pages lib public styles components
mkdir -p app/{auth,dashboard,legal-search}
```

---

## ✅ STEP 3: Create Environment Variables

### For Backend (`apps/api/.env`):
```env
# Existing
APP_NAME=legalens-api
APP_ENV=production
APP_DEBUG=false

# Supabase PostgreSQL
DATABASE_URL=postgresql+psycopg://postgres:[PASSWORD]@[PROJECT-ID].supabase.co:5432/postgres

# Redis (if using Supabase's Redis)
REDIS_URL=redis://[REDIS-URL]

# JWT
JWT_SECRET_KEY=24346f158401e9f5fa3f482a75a553d340124ff8c81a832299a94d356d272ea8
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=14

# Frontend URL (for CORS)
FRONTEND_URL=https://yourapp.vercel.app

# Embeddings
EMBEDDING_DIM=1536

# Supabase
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=[ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE-ROLE-KEY]
```

### For Frontend (`apps/web/.env.local`):
```env
NEXT_PUBLIC_API_URL=https://api.yourapp.com
# Or: http://localhost:8000 (for local development)

NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON-KEY]

# For Vercel (set in dashboard)
```

---

## ✅ STEP 4: Create Next.js API Client

**File:** `apps/web/lib/api-client.ts`

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = {
  async register(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async logout(token: string) {
    const res = await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },

  async refreshToken(refreshToken: string) {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    return res.json();
  },
};
```

---

## ✅ STEP 5: Create Login Page

**File:** `apps/web/app/auth/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiClient.login(email, password);
      
      if (data.access_token) {
        localStorage.setItem('accessToken', data.access_token);
        localStorage.setItem('refreshToken', data.refresh_token);
        router.push('/dashboard');
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">LegalLens Login</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          Don't have an account?{' '}
          <a href="/auth/register" className="text-blue-600 hover:underline">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
```

---

## ✅ STEP 6: Get Supabase Connection Details

Log into your Supabase dashboard and get:

1. **Project URL:** `https://[PROJECT-ID].supabase.co`
2. **Anon Key:** From Settings → API → Project API keys
3. **Service Role Key:** From Settings → API → Project API keys
4. **Database Connection String:** From Settings → Database → Connection string → URI

Update your `.env` files with these values.

---

## ✅ STEP 7: Update Backend to Connect to Supabase

**File:** `apps/api/app/core/config.py`

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "legalens-api"
    APP_ENV: str = "development"
    APP_DEBUG: bool = False

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/legalens"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "your-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
```

---

## ✅ STEP 8: Deploy Backend to Supabase

### Option A: Use Supabase Edge Functions (Recommended for FastAPI)

Supabase supports Deno-based functions. For FastAPI, use a proxy approach or host elsewhere:

### Option B: Deploy to Railway or Render (Best for FastAPI)

**Railway:**
1. Push code to GitHub
2. Connect GitHub repo to Railway
3. Set environment variables
4. Railway auto-deploys

**Render:**
1. Create new Web Service on Render
2. Connect GitHub repo
3. Set environment variables
4. Deploy

---

## ✅ STEP 9: Deploy Frontend to Vercel

```bash
# From project root
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\apps\web

# Install dependencies
npm install

# Set environment variables in Vercel dashboard or .env.production
# NEXT_PUBLIC_API_URL=https://your-api.railway.app
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Deploy
vercel --prod
```

Or connect via GitHub:
1. Push to GitHub
2. Go to Vercel dashboard
3. Import project from GitHub
4. Set environment variables
5. Deploy

---

## ✅ STEP 10: Run Database Migrations on Supabase

The migrations in `apps/api/alembic/` need to run against your Supabase database:

```bash
cd apps/api

# Set Supabase database URL
$env:DATABASE_URL = "postgresql+psycopg://postgres:[PASSWORD]@[PROJECT-ID].supabase.co:5432/postgres"

# Run migrations
alembic upgrade head
```

---

## 🚀 COMPLETE DEPLOYMENT CHECKLIST

### Backend (FastAPI)
- [ ] Add CORS middleware with Vercel domain
- [ ] Update config to support environment variables
- [ ] Test locally with frontend
- [ ] Deploy to Railway/Render with Supabase database
- [ ] Run migrations on Supabase
- [ ] Verify API is accessible from Vercel

### Frontend (Next.js)
- [ ] Initialize Next.js app at `apps/web/`
- [ ] Create API client wrapper
- [ ] Build login/register pages
- [ ] Set environment variables for API URL
- [ ] Test locally
- [ ] Deploy to Vercel
- [ ] Verify frontend can call backend API

### Supabase
- [ ] Create project (if not done)
- [ ] Get connection string
- [ ] Get API keys (anon + service role)
- [ ] Enable pgvector extension
- [ ] Run migrations

### Vercel
- [ ] Connect GitHub repo
- [ ] Set environment variables
- [ ] Configure custom domain (optional)
- [ ] Enable auto-deployments

---

## 📊 Environment Variables Summary

| Variable | Backend | Frontend | Where |
|----------|---------|----------|-------|
| DATABASE_URL | ✅ | - | Supabase |
| SUPABASE_URL | ✅ | ✅ (PUBLIC) | Supabase |
| SUPABASE_ANON_KEY | ✅ | ✅ (PUBLIC) | Supabase |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | - | Supabase |
| JWT_SECRET_KEY | ✅ | - | Generate |
| NEXT_PUBLIC_API_URL | - | ✅ | Your backend URL |
| FRONTEND_URL | ✅ (CORS) | - | Vercel |

---

## 🧪 Testing the Full Stack

### Local Development
```bash
# Terminal 1: Backend
cd apps/api
.\.venv\Scripts\Activate.ps1
$env:DATABASE_URL = "your-supabase-url"
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd apps/web
npm run dev

# Visit: http://localhost:3000
```

### Production (Live)
- Frontend: `https://yourapp.vercel.app`
- Backend: `https://your-api.railway.app`
- Database: Supabase PostgreSQL

---

## 🔗 Quick Links

- **Supabase Dashboard:** https://app.supabase.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Railway Dashboard:** https://railway.app (if using for backend)
- **GitHub Repository:** Link to your repo

---

## ⚡ Next Steps (In Order)

1. ✅ Configure CORS in FastAPI
2. ✅ Initialize Next.js frontend
3. ✅ Create API client & login page
4. ✅ Get Supabase connection details
5. ✅ Test backend ↔ frontend locally
6. ✅ Deploy backend (Railway)
7. ✅ Deploy frontend (Vercel)
8. ✅ Run migrations on Supabase
9. ✅ Test live system
10. ✅ Monitor and iterate

---

**Ready to build LegalLens live? Let's start with the next step! 🚀**
