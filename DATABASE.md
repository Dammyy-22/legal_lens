# Database

PostgreSQL 16 + pgvector. SQLAlchemy models in `apps/api/app/models/`, migrations via
Alembic in `apps/api/alembic/versions/`.

## Verification status

This schema was not just generated — it was applied against a live local Postgres 16 +
pgvector instance and tested:

- Full `alembic upgrade head` on a clean DB — verified, 17 tables created correctly
- Full `alembic downgrade base` — verified, including explicit ENUM type cleanup
  (SQLAlchemy/Alembic does not drop Postgres ENUM types automatically when the owning
  table is dropped — this migration handles it explicitly in `downgrade()`)
- `ck_citation_exactly_one_source` check constraint — verified it rejects a citation
  row with both `chunk_id` and `user_chunk_id` NULL
- Enum value storage — verified `values_callable` is set on every `Enum()` column so
  Postgres stores lowercase values (`user`, `admin`) matching the API/JSON contract,
  not Python's uppercase member names (`USER`, `ADMIN`). This was caught by testing, not
  assumed — the SQLAlchemy default would have stored the wrong values silently.

Not yet tested: performance under real data volume, pgvector index tuning (ivfflat/hnsw —
deferred until Phase 8 when real embedding volume exists to tune against).

## Core design decisions

### Authoritative sources vs. user documents are structurally separate

`legal_sources` / `legal_source_versions` / `legal_sections` / `document_chunks` is one
table family. `user_documents` / `user_document_chunks` is a completely separate family.
There is no shared table and no polymorphic "documents" table. This is deliberate: it
makes it structurally impossible for a bug to cite a user's private upload as if it were
authoritative Nigerian law. The cost is some duplication (two chunk tables, two embedding
columns) — accepted as worth it for this specific safety property.

### Citations always point to a real chunk

`citations.chunk_id` and `citations.user_chunk_id` are both nullable, but a DB-level
CHECK constraint enforces exactly one is set. A citation can never be a bare string or
URL — it must reference a row that was actually retrieved and embedded. Verified live.

### Legal source versioning, not in-place edits

`legal_sources` is the stable identity (e.g. "Labour Act"). `legal_source_versions` holds
dated, immutable content versions with `status` (current/amended/repealed/superseded/
unverified) and `superseded_by_version_id`. Amendments create new version rows; history is
never overwritten. `verified` / `verified_by` / `verified_at` on the version enforce that
nothing is served as authoritative until an admin has actually verified it (§7/§34 of the
build plan — no invented law).

### Legal hierarchy preserved in chunking

`legal_sections` models Part/Chapter/Division/Section/Subsection/Schedule via
self-referential `parent_section_id` + `hierarchy_level`, rather than flat text. Chunks
belong to a section, never float free of legal structure.

### Embedding dimension is a config value, not hardcoded

`EMBEDDING_DIM` in settings (default 1536, matching common embedding model output size).
**This must be finalized before Phase 8** — changing it after real data is embedded
requires a re-embedding migration, not just an env var change. Flagged as a knowledge gap
in the master build plan §32.

## Tables

| Table | Purpose |
|---|---|
| `users`, `sessions` | Auth |
| `legal_sources`, `legal_source_versions`, `legal_sections`, `document_chunks` | Authoritative corpus |
| `user_documents`, `user_document_chunks` | User uploads (Document Q&A) |
| `conversations`, `messages`, `citations` | Assistant interactions |
| `retrieval_events` | Per-retrieval logging for evaluation (query_hash, not raw text, by default) |
| `audit_logs` | Admin/sensitive-action trail |
| `feedback` | User feedback on messages |
| `evaluation_runs`, `evaluation_results` | Versioned eval framework (Phase 17) |

## Known gap

Alembic downgrade drops ENUM types explicitly by name — if new enum-backed columns are
added in future migrations, their types must be added to that cleanup list too, or
downgrade will leave orphaned types. This is a manual-discipline risk worth automating
later (e.g. a lint check in CI that diffs enum types against the downgrade cleanup list).
