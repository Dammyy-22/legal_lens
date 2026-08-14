# 🎯 LegalLens - What To Do First

**GOAL**: Get LegalLens running locally in 30 minutes, then deploy to production.

---

## ⚡ Step 1: Start Backend (5 minutes)

Open **PowerShell** in your project root:

```powershell
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\apps\api
```

Activate Python environment:
```powershell
.\.venv\Scripts\Activate.ps1
```

**If this fails with permission error**, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Start the server:
```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

✅ **Success**: You should see:
```
Uvicorn running on http://127.0.0.1:8000
```

**Keep this terminal open!**

---

## ⚡ Step 2: Start Frontend (5 minutes)

Open **NEW PowerShell** in your project root:

```powershell
cd c:\Users\hp\Documents\legal_lens\legalens-phase5\legalens\apps\web
```

Install dependencies:
```powershell
npm install
```

Create environment file:
```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and make sure:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

(You can get Supabase URL and key from https://app.supabase.com → Settings → API)

Start frontend:
```powershell
npm run dev
```

✅ **Success**: You should see:
```
  ▲ Next.js 14.0.0
  ✓ Ready in 2.3s
  ○ Listening on http://localhost:3000
```

**Keep this terminal open too!**

---

## ⚡ Step 3: Test It (5 minutes)

Open **browser** and go to: `http://localhost:3000`

You should see:

1. **Home Page** ✅
   - LegalLens title
   - "Get Started" button
   - 3 feature boxes

2. **Navigation Works** ✅
   - Click "Register" → Registration form appears
   - Click "Login" → Login form appears

3. **Backend Connected** ✅
   - Open **DevTools** (F12)
   - Go to **Network** tab
   - Refresh page
   - Should see requests to backend (no red X errors)

---

## ⚡ Step 4: Test Registration & Login (10 minutes)

### Register

1. Go to `http://localhost:3000/auth/register`
2. Enter:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Confirm: `TestPassword123!`
3. Click "Create Account"
4. Should see green success message
5. Redirects to login page

### Login

1. Go to `http://localhost:3000/auth/login`
2. Enter:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
3. Click "Sign In"
4. Should see dashboard page with:
   - Welcome message
   - Your email in top right
   - 3 action boxes (Ask Question, Search Laws, Upload Document)
   - Logout button

### Verify Connection

In DevTools → Network tab, you should see:
- `POST http://localhost:8000/api/v1/auth/login` (or register)
- Response includes `access_token`, `user_id`, `email`

✅ **Success**: Full authentication flow working!

---

## ⚡ Step 5: Check Backend Health (2 minutes)

In browser, go to: `http://localhost:8000/docs`

You should see:
- **Swagger UI** with all API endpoints
- `/health` endpoint
- `/api/v1/auth/register` endpoint  
- `/api/v1/auth/login` endpoint
- `/api/v1/auth/logout` endpoint
- etc.

Click **Try it out** on any endpoint to test!

---

## 🎯 Congratulations! 🎉

Your LegalLens app is running locally with:
- ✅ Frontend at http://localhost:3000
- ✅ Backend at http://localhost:8000
- ✅ Authentication working
- ✅ Database connected

---

## 🚀 Next: Deploy to Production

When ready to go live, follow this simple checklist:

### 1. **Setup Supabase** (15 min)
```
Go to app.supabase.com
→ Create project (or use existing)
→ Settings → API → Copy credentials
→ Settings → Database → Copy connection string
→ Update apps/api/.env with DATABASE_URL
→ Run: alembic upgrade head
```

### 2. **Deploy Backend** (20 min)

**Option A: Railway.app** (Recommended)
```
1. Go to railway.app
2. Create account (GitHub login)
3. New Project → Import GitHub repo
4. Root directory: legalens-phase5/legalens/apps/api
5. Add environment variables from .env
6. Deploy
7. Copy deployment URL (e.g., https://api-xyz.railway.app)
```

**Option B: Render.com**
```
1. Go to render.com
2. Create account (GitHub login)
3. New → Web Service
4. Connect GitHub, select repo
5. Root directory: legalens-phase5/legalens/apps/api
6. Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
7. Add environment variables
8. Deploy
9. Copy service URL
```

### 3. **Deploy Frontend** (10 min)

```
1. Go to vercel.com
2. Import your GitHub repo
3. Root directory: legalens-phase5/legalens/apps/web
4. Add environment variables:
   - NEXT_PUBLIC_API_URL = https://api-xyz.railway.app (or your backend URL)
   - NEXT_PUBLIC_SUPABASE_URL = https://xxx.supabase.co
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = xxx
5. Deploy
6. Your frontend is live! 🎉
```

---

## 📋 Environment Variables You'll Need

### For Backend (.env)

```env
DATABASE_URL=postgresql+psycopg://user:password@host:5432/legalens
JWT_SECRET_KEY=<32-byte-random-string>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=["http://localhost:3000","https://*.vercel.app"]
EMBEDDING_DIM=1536
```

To generate JWT_SECRET_KEY, run in Python:
```python
import secrets
print(secrets.token_hex(16))  # Produces 32-byte hex string
```

### For Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000  # Local, or https://api-xyz.railway.app for prod
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

---

## 🆘 Troubleshooting

### Backend won't start
```
Error: "Cannot find module" or "ModuleNotFoundError"
→ Check .venv is activated
→ Run: pip install -r requirements.txt
→ Try: pip list (should show fastapi, sqlalchemy, etc.)
```

### Frontend won't start
```
Error: "npm: command not found"
→ Install Node.js from nodejs.org
→ Restart terminal
→ Try: node --version

Error: "Cannot find module"
→ Run: npm install
→ Delete node_modules and .next folders
→ Run npm install again
```

### Backend and frontend can't talk
```
Error: "CORS error" or "Network error"
→ Make sure backend is running on 8000
→ Check .env.local has NEXT_PUBLIC_API_URL=http://localhost:8000
→ In DevTools, see what URL failed
→ Make sure both are running before frontend loads
```

### Login fails
```
Error: "Invalid email or password" or "500 error"
→ Check you registered first
→ Check password is exactly: TestPassword123!
→ Look at backend terminal for error messages
→ Check DATABASE_URL is valid
```

---

## 📞 Quick Reference

| What | Command |
|------|---------|
| **Start Backend** | `cd apps/api && .venv\Scripts\Activate.ps1 && uvicorn app.main:app --reload` |
| **Start Frontend** | `cd apps/web && npm run dev` |
| **Backend URL** | `http://localhost:8000` |
| **Frontend URL** | `http://localhost:3000` |
| **API Docs** | `http://localhost:8000/docs` |
| **Run Tests** | `cd apps/api && pytest tests/integration -v` |
| **Install Dependencies** | `pip install -r requirements.txt` (backend) or `npm install` (frontend) |

---

## ✅ Success Checklist

After following this guide, you should have:

- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:3000
- [ ] Able to see API docs at http://localhost:8000/docs
- [ ] Able to register new user
- [ ] Able to login with credentials
- [ ] See dashboard after login
- [ ] Able to logout
- [ ] No CORS errors in console
- [ ] No 404 or 500 errors in backend terminal

If all ✅, you're ready to deploy!

---

**Next Step**: Read [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) to deploy to production.

*Good luck! 🚀*
