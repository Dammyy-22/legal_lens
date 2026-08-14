import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import MessageRole, RiskLevel


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    jurisdiction: Mapped[str] = mapped_column(String(128), nullable=False, default="Nigeria")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole, name="message_role", values_callable=lambda x: [e.value for e in x]), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel, name="risk_level", values_callable=lambda x: [e.value for e in x]), nullable=False, default=RiskLevel.STANDARD)
    is_uncertain: Mapped[bool] = mapped_column(nullable=False, default=False)  # true when the system could not fully ground the answer
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    citations: Mapped[list["Citation"]] = relationship(back_populates="message", cascade="all, delete-orphan")


class Citation(Base):
    """A citation MUST point to a real retrieved chunk (authoritative or user-document) —
    never a bare string/URL. Exactly one of chunk_id / user_chunk_id must be set."""
    __tablename__ = "citations"
    __table_args__ = (
        CheckConstraint(
            "(chunk_id IS NOT NULL AND user_chunk_id IS NULL) OR "
            "(chunk_id IS NULL AND user_chunk_id IS NOT NULL)",
            name="ck_citation_exactly_one_source",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=True)
    user_chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("user_document_chunks.id", ondelete="CASCADE"), nullable=True)
    quoted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    message: Mapped["Message"] = relationship(back_populates="citations")
