"""
Application settings.

All configuration is sourced from environment variables (see .env.example at the repo
root). Never hardcode secrets, credentials, or environment-specific values here.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "legalens-api"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/legalens"

    # Auth (Phase 5 — declared now so config is centralized; values MUST be overridden
    # via environment in any real deployment, never committed)
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_ENV"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # Redis (introduced fully in a later phase; declared for forward compatibility)
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS: comma-separated list of allowed frontend origins. Local dev default covers
    # `next dev`'s default port; production MUST override this via env, never wildcard.
    CORS_ALLOWED_ORIGINS_RAW: str = "http://localhost:3000"

    @property
    def CORS_ALLOWED_ORIGINS(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS_RAW.split(",") if o.strip()]

    # Embeddings dimensionality — must match the embedding model used by services/ai.
    # Placeholder default; MUST be revisited when the embedding model is finalized in
    # Phase 8, since pgvector column dimension is fixed at migration time.
    EMBEDDING_DIM: int = 1536


settings = Settings()
