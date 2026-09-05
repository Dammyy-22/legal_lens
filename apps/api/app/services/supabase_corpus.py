from typing import Any

import httpx

from app.core.config import settings


class SupabaseCorpusError(RuntimeError):
    pass


def query_corpus(path: str, access_token: str, params: list[tuple[str, str]]) -> list[dict[str, Any]]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise SupabaseCorpusError("Supabase corpus connection is not configured")

    response = httpx.get(
        f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{path}",
        params=params,
        headers={
            "apikey": settings.SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {access_token}",
        },
        timeout=15,
    )
    if response.is_error:
        raise SupabaseCorpusError(f"Supabase corpus query failed ({response.status_code})")
    body = response.json()
    if not isinstance(body, list):
        raise SupabaseCorpusError("Supabase corpus returned an invalid response")
    return body