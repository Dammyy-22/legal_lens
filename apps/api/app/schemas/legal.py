from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LegalSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    chunk_id: UUID
    source_id: UUID
    version_id: UUID
    source_title: str
    source_url: str
    version_label: str
    section_label: str
    section_heading: str | None
    status: str
    effective_date: date | None
    text: str


class LegalSearchResponse(BaseModel):
    query: str
    results: list[LegalSearchResult]


class LegalSearchQuery(BaseModel):
    q: str = Field(min_length=2, max_length=500)
    limit: int = Field(default=20, ge=1, le=50)