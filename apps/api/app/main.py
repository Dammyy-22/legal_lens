from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.deps import SupabaseUser, get_current_supabase_user
from app.api.legal import router as legal_router
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)

# CORS: the Next.js frontend runs on a different origin (localhost:3000) than the API
# (localhost:8000) in local dev, and on a different domain in production. Without this,
# every browser request from the web app is blocked before it reaches any route below —
# this was missing entirely, which meant the frontend and backend had never actually
# been exercised together.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(legal_router)


@app.get("/health")
def health() -> dict:
    """Liveness/readiness probe. Deliberately has no DB dependency so it stays cheap;
    a separate /health/db check can be added when the app has real DB-backed routes."""
    return {"status": "ok", "env": settings.APP_ENV}


@app.get("/api/v1/auth/supabase/me")
def supabase_me(user: SupabaseUser = Depends(get_current_supabase_user)) -> dict:
    return {"id": str(user.id), "role": user.role, "email": user.email}


# Remaining domain routers (assistant, search, sources, rights, documents,
# conversations, admin) are added in their respective build phases (8-16).
