"""
Import every model module here so Alembic's autogenerate (Base.metadata) sees all tables.
"""
from app.models.conversation import Citation, Conversation, Message  # noqa: F401
from app.models.legal_source import (  # noqa: F401
    DocumentChunk,
    LegalSection,
    LegalSource,
    LegalSourceVersion,
)
from app.models.observability import (  # noqa: F401
    AuditLog,
    EvaluationResult,
    EvaluationRun,
    Feedback,
    RetrievalEvent,
)
from app.models.user import User, UserSession  # noqa: F401
from app.models.user_document import UserDocument, UserDocumentChunk  # noqa: F401
