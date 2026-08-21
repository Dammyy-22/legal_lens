import enum


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class AuthorityLevel(str, enum.Enum):
    PRIMARY = "primary"          # Constitution, Acts, official regulations/gazette
    INSTITUTIONAL = "institutional"  # government agencies, official procedural guidance
    SECONDARY = "secondary"      # vetted commentary — never overrides primary


class DocumentType(str, enum.Enum):
    CONSTITUTION = "constitution"
    LEGISLATION = "legislation"
    REGULATION = "regulation"
    CASE_LAW = "case_law"
    AGENCY_GUIDANCE = "agency_guidance"
    SECONDARY_COMMENTARY = "secondary_commentary"


class SourceStatus(str, enum.Enum):
    CURRENT = "current"
    AMENDED = "amended"
    REPEALED = "repealed"
    SUPERSEDED = "superseded"
    UNVERIFIED = "unverified"  # ingested but not yet passed verification — never served


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    EXTRACTED = "extracted"
    CHUNKED = "chunked"
    EMBEDDED = "embedded"
    INDEXED = "indexed"
    PUBLISHED = "published"
    FAILED = "failed"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class RiskLevel(str, enum.Enum):
    STANDARD = "standard"
    HIGH_RISK = "high_risk"  # arrest/detention/violence/imminent deadline
