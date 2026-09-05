from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.deps import SupabaseUser, get_current_supabase_user
from app.services.supabase_corpus import SupabaseCorpusError, query_corpus
from app.schemas.legal import LegalSearchResponse, LegalSearchResult

router = APIRouter(prefix="/api/v1/legal", tags=["legal"])
bearer_scheme = HTTPBearer()


def _in_filter(values: list[str]) -> str:
    return f"({','.join(values)})"


def _load_verified_corpus(access_token: str) -> tuple[list[dict], dict[str, dict], dict[str, dict]]:
    versions = query_corpus(
        "legal_source_versions",
        access_token,
        [("select", "id,source_id,version_label,status,effective_date"), ("verified", "eq.true"), ("status", "eq.current"), ("limit", "1000")],
    )
    version_ids = [row["id"] for row in versions]
    if not version_ids:
        return [], {}, {}
    sources = query_corpus(
        "legal_sources",
        access_token,
        [("select", "id,title,source_url"), ("id", f"in.{_in_filter(sorted({row['source_id'] for row in versions}))}"), ("limit", "1000")],
    )
    sections = query_corpus(
        "legal_sections",
        access_token,
        [("select", "id,label,heading"), ("version_id", f"in.{_in_filter(version_ids)}"), ("limit", "5000")],
    )
    chunks = query_corpus(
        "document_chunks",
        access_token,
        [("select", "id,version_id,section_id,text"), ("version_id", f"in.{_in_filter(version_ids)}"), ("limit", "10000")],
    )
    return chunks, {row["id"]: row for row in [*sources, *versions]}, {row["id"]: row for row in sections}


@router.get("/search", response_model=LegalSearchResponse)
def search_legal_sources(
    q: str = Query(min_length=2, max_length=500),
    limit: int = Query(default=20, ge=1, le=50),
    _: SupabaseUser = Depends(get_current_supabase_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> LegalSearchResponse:
    """Search only verified, current legal content with full provenance."""
    try:
        chunks, records, sections = _load_verified_corpus(credentials.credentials)
    except SupabaseCorpusError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    terms = q.lower().split()
    rows = []
    for chunk in chunks:
        version = records.get(chunk["version_id"], {})
        source = records.get(version.get("source_id"), {})
        searchable = f"{source.get('title', '')} {chunk.get('text', '')}".lower()
        if all(term in searchable for term in terms):
            section = sections.get(chunk["section_id"], {})
            rows.append(LegalSearchResult(
                chunk_id=chunk["id"], source_id=source["id"], version_id=version["id"],
                source_title=source["title"], source_url=source["source_url"],
                version_label=version["version_label"], section_label=section["label"],
                section_heading=section.get("heading"), status=version["status"],
                effective_date=version.get("effective_date"), text=chunk["text"],
            ))
            if len(rows) >= limit:
                break
    return LegalSearchResponse(
        query=q,
        results=rows,
    )


@router.get("/constitution", response_model=list[LegalSearchResult])
def get_constitution(
    _: SupabaseUser = Depends(get_current_supabase_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> list[LegalSearchResult]:
    try:
        chunks, records, sections = _load_verified_corpus(credentials.credentials)
    except SupabaseCorpusError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    results = []
    for chunk in chunks:
        version = records.get(chunk["version_id"], {})
        source = records.get(version.get("source_id"), {})
        if "constitution" not in source.get("title", "").lower():
            continue
        section = sections.get(chunk["section_id"], {})
        results.append(LegalSearchResult(
            chunk_id=chunk["id"], source_id=source["id"], version_id=version["id"],
            source_title=source["title"], source_url=source["source_url"],
            version_label=version["version_label"], section_label=section["label"],
            section_heading=section.get("heading"), status=version["status"],
            effective_date=version.get("effective_date"), text=chunk["text"],
        ))
    return results