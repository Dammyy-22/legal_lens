"""
Authoritative legal-source models.

These tables are the ONLY tables the AI orchestration layer may cite from as authoritative
legal sources. User-uploaded documents live in a structurally separate table family
(see app/models/user_document.py) so it is impossible, at the schema level, to accidentally
present a user's private document as authoritative law.
"""
import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.db import Base
from app.models.enums import AuthorityLevel, DocumentType, ProcessingStatus, SourceStatus


class LegalSource(Base):
    """A logical legal document (e.g. 'Labour Act'). Immutable identity; content changes
    over time are represented as LegalSourceVersion rows, never in-place edits."""
    __tablename__ = "legal_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(128), nullable=False, index=True)  # e.g. "Nigeria" or "Nigeria-Lagos"
    country: Mapped[str] = mapped_column(String(64), nullable=False, index=True, default="Nigeria")
    issuing_authority: Mapped[str] = mapped_column(String(255), nullable=False)
    document_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType, name="document_type", values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    authority_level: Mapped[AuthorityLevel] = mapped_column(Enum(AuthorityLevel, name="authority_level", values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    versions: Mapped[list["LegalSourceVersion"]] = relationship(back_populates="source", cascade="all, delete-orphan")


class LegalSourceVersion(Base):
    """An immutable, dated version of a source's content. Amendments/repeals create a new
    version row and update `status`/`superseded_by` rather than mutating history."""
    __tablename__ = "legal_source_versions"
    __table_args__ = (UniqueConstraint("source_id", "version_label", name="uq_source_version_label"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("legal_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    version_label: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "2004-consolidated", "2023-amendment"
    publication_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amendment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[SourceStatus] = mapped_column(Enum(SourceStatus, name="source_status", values_callable=lambda x: [e.value for e in x]), nullable=False, default=SourceStatus.UNVERIFIED, index=True)
    superseded_by_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("legal_source_versions.id"), nullable=True)
    processing_status: Mapped[ProcessingStatus] = mapped_column(Enum(ProcessingStatus, name="processing_status", values_callable=lambda x: [e.value for e in x]), nullable=False, default=ProcessingStatus.PENDING, index=True)

    # Provenance / integrity
    original_object_key: Mapped[str | None] = mapped_column(Text, nullable=True)  # S3-compatible object key for immutable original
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # per §7/§34: never authoritative until verified
    verified_by: Mapped[str | None] = mapped_column(String(255), nullable=True)  # admin identifier
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    source: Mapped["LegalSource"] = relationship(back_populates="versions", foreign_keys=[source_id])
    sections: Mapped[list["LegalSection"]] = relationship(back_populates="version", cascade="all, delete-orphan", foreign_keys="LegalSection.version_id")


class LegalSection(Base):
    """Structural node within a version, preserving legal hierarchy (Part/Chapter/
    Section/Subsection/Schedule) rather than flat character-count chunking."""
    __tablename__ = "legal_sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("legal_source_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_section_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("legal_sections.id", ondelete="CASCADE"), nullable=True)
    hierarchy_level: Mapped[str] = mapped_column(String(32), nullable=False)  # part|chapter|division|section|subsection|paragraph|schedule
    label: Mapped[str] = mapped_column(String(128), nullable=False)  # e.g. "Section 35", "Schedule 2"
    heading: Mapped[str | None] = mapped_column(String(512), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    version: Mapped["LegalSourceVersion"] = relationship(back_populates="sections", foreign_keys=[version_id])
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="section", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """Retrieval-unit chunk with embedding. Always tied to a section (and transitively a
    version/source) — a chunk can never exist without full provenance lineage."""
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("legal_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("legal_source_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBEDDING_DIM), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    section: Mapped["LegalSection"] = relationship(back_populates="chunks")
