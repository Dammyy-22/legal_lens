# 📋 LegalLens Deployment Checklist

Use this checklist to guide your deployment from local development to production with Supabase + Vercel.

## Phase 1: Local Setup ✅ (Should be complete)

- [ ] **Backend**
  - [ ] Python 3.10+ installed
  - [ ] Virtual environment created: `.venv`
  - [ ] Dependencies installed: `pip install -r requirements.txt`
  - [ ] `.env` file created with `JWT_SECRET_KEY` and database URL
  - [ ] Backend starts without errors: `uvicorn app.main:app --reload`
  - [ ] API docs accessible at `http://localhost:8000/docs`
  - [ ] Health check passes: `GET http://localhost:8000/health`

- [ ] **Frontend**
  - [ ] Node.js 18+ installed
  - [ ] Dependencies installed: `npm install`
  - [ ] `.env.local` created with `NEXT_PUBLIC_API_URL=http://localhost:8000`
  - [ ] Frontend starts without errors: `npm run dev`
  - [ ] Home page loads at `http://localhost:3000`

- [ ] **Local Testing**
  - [ ] Can access login page
  - [ ] Can access register page
  - [ ] Backend and frontend communicate (check Network tab in DevTools)
  - [ ] Integration tests pass: `pytest tests/integration -v`

## Phase 2: Supabase Setup 🌐

- [ ] **Create/Access Supabase Project**
  - [ ] Go to https://app.supabase.com
  - [ ] Create new project or select existing
  - [ ] Project name: `legalens` (or your preference)
  - [ ] Region: Choose closest to Nigeria (EU-West or US-East)
  - [ ] Note project ID for later

- [ ] **Get Supabase Credentials**
  - [ ] Go to **Settings → API**
  - [ ] Copy `Project URL` → Store as `SUPABASE_URL`
  - [ ] Copy `anon public` key → Store as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] Copy `service_role secret` key → Store as `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] Go to **Settings → Database**
  - [ ] Copy connection string → Store as `DATABASE_URL`

- [ ] **Run Database Migrations**
  - [ ] Update `apps/api/.env` with `DATABASE_URL` from Supabase
  - [ ] Run: `cd apps/api`
  - [ ] Activate venv: `.\.venv\Scripts\Activate.ps1`
  - [ ] Migrate: `alembic upgrade head`
  - [ ] Verify tables exist in Supabase dashboard
  - [ ] Check migrations in `Alembic_version` table

- [ ] **Set Up Supabase Auth** (Optional but recommended)
  - [ ] Go to **Authentication → Settings**
  - [ ] Configure email settings
  - [ ] Add authorized redirect URLs:
    - `http://localhost:3000` (local)
    - `https://<your-vercel-domain>.vercel.app` (production)

## Phase 3: Backend Deployment 🚀

### Option A: Railway.app (Recommended)

- [ ] **Create Railway Account**
  - [ ] Go to https://railway.app
  - [ ] Sign up with GitHub (recommended)
  - [ ] Create new project

- [ ] **Configure Railway**
  - [ ] Connect to GitHub repository
  - [ ] Select `legalens-phase5/legalens/apps/api` as root
  - [ ] Add environment variables:
    - `DATABASE_URL` → From Supabase
    - `JWT_SECRET_KEY` → 32-byte random
    - `REDIS_URL` → Railway Redis addon
    - `CORS_ORIGINS` → Include Vercel domain
    - `EMBEDDING_DIM` → 1536

- [ ] **Deploy to Railway**
  - [ ] Push to main branch
  - [ ] Railway auto-deploys
  - [ ] Copy deployment URL (e.g., `https://api-xyz.railway.app`)
  - [ ] Test health check: `curl https://api-xyz.railway.app/health`
  - [ ] Test login endpoint: `curl -X POST https://api-xyz.railway.app/api/v1/auth/login`

### Option B: Render.com

- [ ] **Create Render Account**
  - [ ] Go to https://render.com
  - [ ] Sign up with GitHub

- [ ] **Configure Render**
  - [ ] New → Web Service
  - [ ] Connect GitHub repo
  - [ ] Settings:
    - Name: `legalens-api`
    - Root directory: `legalens-phase5/legalens/apps/api`
    - Environment: `Python 3.10`
    - Build command: `pip install -r requirements.txt`
    - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

- [ ] **Add Environment Variables**
  - [ ] Database URL
  - [ ] JWT Secret
  - [ ] Redis URL
  - [ ] CORS origins

- [ ] **Deploy**
  - [ ] Click Deploy
  - [ ] Wait for build to complete (5-10 min)
  - [ ] Copy service URL

## Phase 4: Frontend Deployment 📦

- [ ] **Update Backend URL**
  - [ ] Note your backend deployment URL (e.g., `https://api-xyz.railway.app`)
  - [ ] Update `apps/web/.env.local`:
    ```
    NEXT_PUBLIC_API_URL=https://api-xyz.railway.app
    NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
    ```

- [ ] **Test Production Build Locally**
  - [ ] `cd apps/web`
  - [ ] `npm run build`
  - [ ] Verify no build errors
  - [ ] `npm run start`
  - [ ] Test at `http://localhost:3000`

- [ ] **Deploy to Vercel**
  - [ ] Go to https://vercel.com
  - [ ] Import GitHub repository
  - [ ] Settings:
    - Project name: `legalens`
    - Framework: Next.js
    - Root directory: `legalens-phase5/legalens/apps/web`
  - [ ] Add environment variables:
    - `NEXT_PUBLIC_API_URL` → Your backend URL
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] Click Deploy
  - [ ] Wait for deployment (2-5 min)
  - [ ] Copy deployment URL

- [ ] **Verify Deployment**
  - [ ] Open Vercel URL in browser
  - [ ] Check home page loads
  - [ ] Test navigation to login/register
  - [ ] Verify backend URL in Network tab (DevTools)
  - [ ] Check console for errors

## Phase 5: Verify Production

- [ ] **Frontend Tests**
  - [ ] Home page loads and renders
  - [ ] Navigation works
  - [ ] Login page accessible
  - [ ] Register page accessible
  - [ ] Links styled correctly with Tailwind CSS

- [ ] **API Tests**
  - [ ] Test register endpoint with new email
  - [ ] Test login with registered credentials
  - [ ] Verify JWT token in response
  - [ ] Test logout endpoint
  - [ ] Verify error handling (invalid email format, etc.)

- [ ] **Database Tests**
  - [ ] User created in Supabase after registration
  - [ ] Password hashed (not plaintext)
  - [ ] JWT tokens valid and properly signed
  - [ ] Password reset functionality works

- [ ] **Security Tests**
  - [ ] HTTPS enforced in production
  - [ ] CORS only allows Vercel domain
  - [ ] JWT tokens have expiration
  - [ ] Passwords meet requirements (8+ chars, strength validation)

## Phase 6: Continuous Deployment

- [ ] **GitHub Actions (Optional)**
  - [ ] Add tests to CI/CD pipeline
  - [ ] Auto-deploy on main branch push
  - [ ] Configure notifications

- [ ] **Monitoring**
  - [ ] Set up error tracking (Sentry)
  - [ ] Monitor API logs (Railway/Render)
  - [ ] Set up uptime monitoring

- [ ] **Documentation**
  - [ ] Document deployment steps for team
  - [ ] Create runbooks for common issues
  - [ ] Document environment variable requirements

## Phase 7: Going Live

- [ ] **Domain Setup**
  - [ ] Purchase/use domain
  - [ ] Point to Vercel URL or custom domain
  - [ ] Set up SSL certificate (automatic with Vercel)

- [ ] **Analytics & Monitoring**
  - [ ] Add Google Analytics
  - [ ] Set up error tracking
  - [ ] Configure backend monitoring

- [ ] **Publicity**
  - [ ] Update README with live URL
  - [ ] Share with users
  - [ ] Gather feedback

## Troubleshooting Reference

| Issue | Solution |
|-------|----------|
| Frontend 404 in Vercel | Check root directory is `apps/web` in Vercel settings |
| Backend CORS errors | Add Vercel domain to `CORS_ORIGINS` in backend .env |
| Supabase connection fails | Verify DATABASE_URL format and IP whitelist |
| Login fails with 500 | Check backend logs in Railway/Render console |
| JWT token invalid | Verify `JWT_SECRET_KEY` matches across environments |
| Email not working | Configure Supabase email settings |
| Build fails on Vercel | Run `npm run build` locally to see errors |

## Rollback Plan

If something goes wrong:

1. **Frontend**: Revert deployment in Vercel (previous version)
2. **Backend**: Revert git commit and re-deploy
3. **Database**: Have backup before running migrations
4. **Environment**: Keep old .env files as backup

## Success Criteria ✅

- [ ] Frontend loads at production URL
- [ ] Backend API responds at production URL
- [ ] User can register with new email
- [ ] User can login with credentials
- [ ] Dashboard displays after login
- [ ] Logout works and redirects to home
- [ ] No console errors or CORS issues
- [ ] All integration tests pass
- [ ] Database operations working (users stored)
- [ ] API documentation available at `/docs`

---

**Total estimated time**: 1-2 hours for first-time deployment

**Need help?** Check the logs:
- Vercel: Dashboard → Deployments → View logs
- Railway/Render: Dashboard → Logs tab
- Supabase: Dashboard → Database → Query logs
- Backend: Check terminal output or logs

