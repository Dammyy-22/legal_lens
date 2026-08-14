from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)
app.include_router(auth_router)


@app.get("/health")
def health() -> dict:
    """Liveness/readiness probe. Deliberately has no DB dependency so it stays cheap;
    a separate /health/db check can be added when the app has real DB-backed routes."""
    return {"status": "ok", "env": settings.APP_ENV}


# Remaining domain routers (assistant, search, sources, rights, documents,
# conversations, admin) are added in their respective build phases (8-16).
