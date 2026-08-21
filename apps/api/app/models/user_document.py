"""
User-uploaded document models.

These are deliberately a SEPARATE table family from app/models/legal_source.py.
The AI orchestration and citation-validation layers must never treat a row from these
tables as an authoritative legal source (see build plan §7, §24).
"""
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.db import Base
from app.models.enums import ProcessingStatus


class UserDocument(Base):
    __tablename__ = "user_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    object_key: Mapped[str] = mapped_column(Text, nullable=False)  # S3-compatible storage key
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    processing_status: Mapped[ProcessingStatus] = mapped_column(Enum(ProcessingStatus, name="user_doc_processing_status", values_callable=lambda x: [e.value for e in x]), nullable=False, default=ProcessingStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # secure-delete marker

    chunks: Mapped[list["UserDocumentChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class UserDocumentChunk(Base):
    __tablename__ = "user_document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBEDDING_DIM), nullable=True)

    document: Mapped["UserDocument"] = relationship(back_populates="chunks")
