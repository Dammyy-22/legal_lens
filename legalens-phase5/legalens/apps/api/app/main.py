from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered legal information platform for Nigeria",
    version="0.5.0"
)

# CORS configuration for frontend (Vercel, local development, custom domains)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local Next.js dev
        "http://localhost:8000",  # Local backend
        "https://localhost:3000",
        "https://localhost:8000",
        "https://*.vercel.app",   # Any Vercel deployment
        "https://legalens.vercel.app",  # Your specific Vercel domain
        # Add custom domains as needed:
        # "https://yourdomain.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

app.include_router(auth_router)


@app.get("/health")
def health() -> dict:
    """Liveness/readiness probe. Deliberately has no DB dependency so it stays cheap;
    a separate /health/db check can be added when the app has real DB-backed routes."""
    return {"status": "ok", "env": settings.APP_ENV}


# Remaining domain routers (assistant, search, sources, rights, documents,
# conversations, admin) are added in their respective build phases (8-16).
