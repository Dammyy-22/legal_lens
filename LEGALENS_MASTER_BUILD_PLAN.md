# LEGALENS MASTER BUILD PLAN

Status: DRAFT FOR REVIEW — no application code written yet.
Jurisdiction: Nigeria (initial), architecture jurisdiction-extensible.

---

## 1. Product Definition

LegalLens is an AI-powered **legal information and rights-assistance platform**. It helps
non-lawyers in Nigeria understand laws, rights, procedures and obligations, grounded in
authoritative legal sources, with visible citations and explicit uncertainty.

**What LegalLens is:** a legal-information and legal-literacy tool with retrieval-grounded AI.

**What LegalLens is not:** a licensed attorney, a source of legal advice, a document-drafting
authority, or a guarantee of legal outcomes. Every surface of the product must make this
distinction visible (onboarding, chat disclaimers, footer, ToS).

Core differentiator vs. a generic chatbot: **answers are only as good as the retrievable,
verified source corpus** — the system refuses rather than fabricates when evidence is
insufficient.

---

## 2. User Personas

| Persona | Context | Needs |
| --- | --- | --- |
| Ada, university student | First encounter with tenancy dispute | Plain-language rights explanation, cite-backed |
| Chidi, commercial driver | Stopped at a checkpoint | Fast, calm, rights-during-stop guidance |
| Ngozi, small shop owner | Registering/operating a business | Regulatory obligations, consumer law |
| Emeka, salaried worker | Wrongful termination concern | Employment law basics, next steps, when to see a lawyer |
| Fatima, tenant | Landlord dispute, has a lease PDF | Document Q&A over her own lease |
| Admin/ops (internal) | Curates legal source corpus | Source ingestion, verification, versioning tools |

Common trait: low-to-moderate legal literacy, needs plain language without losing legal
accuracy, needs to know when to escalate to a real lawyer.

---

## 3. User Journeys (MVP)

1. **Ask a question** → Assistant → grounded answer with citations → optional follow-ups →
   "talk to a lawyer" prompt if high-risk.
2. **Search a law** → Legal Search → filter by jurisdiction/type/status → open Source Explorer.
3. **Upload a document** → Document Q&A → ask questions scoped to that document → cited to
   page/section of the *user's* document (clearly separated from authoritative sources).
4. **Browse a life situation** → Rights Explorer (e.g., "stopped by police") → structured,
   source-backed explainer.
5. **High-risk situation** (arrest, detention, violence, imminent deadline) → system
   short-circuits to safety-first guidance + escalation resources, minimizes speculative
   legal analysis.

---

## 4. MVP Scope

**In scope:** AI Assistant (RAG-grounded chat), Legal Search, Source Explorer, Rights
Explorer (small curated set of situations), Document Q&A (single-document, user-owned),
auth, conversation history, admin source-management console (minimal), evaluation harness,
CI, containerized deployment.

**Explicitly out of scope for MVP:** multilingual/voice, lawyer marketplace, document
generation, case-law search, multi-jurisdiction, mobile apps, WhatsApp, offline mode. These
are designed-for but not built now (see §5 roadmap and §9 architecture extensibility notes).

**MVP success condition:** a user can ask a real Nigerian legal-information question and
receive an answer that is either (a) grounded in a cited, verifiable primary/secondary source
in the corpus, or (b) an explicit "insufficient verified evidence" refusal — never a
fabricated citation.

---

## 5. Future Roadmap (post-MVP, architecture must not block these)

Voice/multilingual (incl. Nigerian languages) · location-aware guidance · lawyer directory/
referral · document generation · contract/document comparison · case-law search · legal
deadline tracking · issue triage · legal education courses · legal-aid discovery · personal
legal document vault · mobile apps · WhatsApp interface · offline mode · additional
jurisdictions (state-level Nigeria first, then other countries).

---

## 6. Functional Requirements

FR1. Users register/authenticate and manage sessions securely.
FR2. Users submit natural-language legal questions and receive grounded, cited answers.
FR3. Users search the legal corpus by keyword/semantic query with metadata filters.
FR4. Users open a Source Explorer view for any cited document (full provenance metadata).
FR5. Users browse curated Rights Explorer situations.
FR6. Users upload a supported document (PDF/DOCX, size-limited) and ask questions about it.
FR7. System distinguishes user-uploaded documents from authoritative sources at all times.
FR8. System detects high-risk queries and prioritizes safety guidance over legal analysis.
FR9. System exposes source status (current/superseded/repealed) and effective dates.
FR10. Admins ingest, verify, version, and retire legal sources through an internal console.
FR11. System logs retrieval + generation events for evaluation without over-retaining PII.
FR12. System supports conversation history per authenticated user.

## 7. Non-Functional Requirements

NFR1. **Groundedness over fluency** — no answer ships without passing citation validation
or an explicit uncertainty flag.
NFR2. Availability target for MVP: best-effort single-region, documented SLIs (not a
formal SLA yet) — see §26.
NFR3. p95 assistant response latency target: < 6s for retrieval+generation (cache-assisted
where possible); degrade gracefully (show retrieval progress) rather than block silently.
NFR4. Horizontal scalability of the API/worker tier; stateless application layer.
NFR5. All secrets via environment/secret manager; zero secrets in VCS.
NFR6. Data minimization: no legal-question content retained beyond what's needed for the
user's own history + anonymized/aggregated evaluation sampling with consent.
NFR7. Accessibility: WCAG 2.1 AA target for core flows.
NFR8. Auditability: every citation traceable to a source_id + version + retrieval event.
NFR9. Cost observability: token/embedding/storage cost attribution per request class.

---

## 8. Legal Safety Requirements (product-level, enforced architecturally)

- Never state or imply LegalLens is a lawyer or provides legal advice; every AI response
  carries a persistent, non-dismissible-on-first-use disclaimer pattern.
- No citation may be generated without a corresponding retrieved, stored source passage.
- No legal conclusion may be produced from model memory alone when the corpus has no
  supporting passage — the system must degrade to "not enough verified information."
- Jurisdiction must be resolved (default Nigeria for MVP, but explicit in schema) before
  any jurisdiction-sensitive claim is made.
- Source status (current/amended/repealed) must be surfaced whenever it affects the answer.
- High-risk query classification (arrest/detention/violence/imminent deadline) triggers a
  safety-first response template regardless of retrieval quality.
- Confidence must never be presented as a bare "legally correct" percentage.

---

## 9. System Architecture

```text
                         ┌─────────────────────────┐
                         │        Next.js Web        │
                         └────────────┬─────────────┘
                                      │ HTTPS/JSON
                         ┌────────────▼─────────────┐
                         │        FastAPI API         │  (authn/z, rate limit, validation)
                         └───┬─────────┬─────────┬───┘
                 ┌───────────┘         │         └───────────┐
        ┌────────▼───────┐   ┌─────────▼────────┐  ┌─────────▼────────┐
        │ Ingestion Svc   │   │  Retrieval Svc     │  │  AI Orchestration │
        │ (sources →      │   │ (hybrid search,    │  │ (context build,   │
        │  chunks/embeds) │   │  filter, rerank)    │  │  LLM call,        │
        └────────┬────────┘   └─────────┬────────┘  │  citation+safety   │
                 │                       │            │  validation)       │
        ┌────────▼───────────────────────▼────────┐  └─────────┬─────────┘
        │        PostgreSQL + pgvector              │            │
        │  sources / versions / sections / chunks /  │◄───────────┘
        │  embeddings / users / conversations / ...  │
        └────────┬───────────────────────────────────┘
                 │
        ┌────────▼───────┐   ┌────────────────────┐
        │ Redis (cache,   │   │ S3-compatible store │  (originals, uploads)
        │ rate limit)     │   │                     │
        └─────────────────┘   └────────────────────┘

        Evaluation Service (offline + sampled online) reads from retrieval_events,
        citations, conversations; writes eval results to its own tables.
```

Architecture style: **modular monolith** for the API (FastAPI, internally modular by
domain: auth, sources, retrieval, ai, documents, admin, evaluation). Ingestion and
evaluation are separable services from day one because their execution profile (batch,
CPU/IO heavy) differs from request/response API traffic — this is the one deliberate
deviation from "single service," justified by workload shape, not fashion.

Jurisdiction extensibility: every source, section and chunk row carries `jurisdiction`
and `country` fields from day one; retrieval filters on them; query classification
resolves a jurisdiction before answering. Adding a second country/state means adding
rows and a config entry, not a schema migration.

---

## 10. Technology Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind | matches Forge default |
| Backend | Python, FastAPI | modular monolith, domain-separated routers/services |
| DB | PostgreSQL + pgvector | relational + vector in one engine, avoids extra infra |
| Cache/rate-limit | Redis | sessions, rate limiting, hot retrieval cache |
| Object storage | S3-compatible | original source docs, user uploads |
| Search | pgvector (semantic) + Postgres full-text (lexical) hybrid | no separate search engine for MVP |
| Auth | FastAPI + JWT/session hybrid, argon2/bcrypt password hashing | server-enforced authz |
| AI provider | Provider-agnostic abstraction layer | swappable model backend |
| Containers | Docker / docker-compose (dev) | |
| CI/CD | GitHub Actions | lint, test, security scan, build |
| IaC | Terraform (introduced at deployment phase) | cloud-portable |
| Observability | OpenTelemetry-compatible structured logging/tracing | |

No microservice sprawl, no dedicated vector DB, no separate search engine — all deferred
until the modular monolith demonstrably can't cope.

---

## 11. Repository Structure

```text
legalens/
├── README.md, PROJECT_SPEC.md, REQUIREMENTS.md, ARCHITECTURE.md, TECH_STACK.md,
│   SECURITY.md, THREAT_MODEL.md, AI_SAFETY.md, RAG_SPEC.md, EVALUATION.md,
│   TESTING.md, DEPLOYMENT.md, DATABASE.md, API.md, DECISIONS.md
├── .env.example, .gitignore, docker-compose.yml
├── apps/
│   ├── web/            # Next.js
│   └── api/             # FastAPI app (routers only; logic in services/)
├── services/
│   ├── ingestion/       # source fetch/validate/extract/chunk/embed
│   ├── retrieval/       # hybrid search, filtering, reranking
│   ├── ai/               # orchestration, prompting, citation+safety validation
│   └── evaluation/       # offline eval harness, red-team suite
├── packages/
│   ├── types/            # shared TS/py schema contracts (OpenAPI-generated where possible)
│   ├── config/            # jurisdiction, model, feature config
│   └── shared/            # shared utils
├── database/
│   ├── migrations/
│   └── seeds/             # non-legal seed data only (e.g. dev users) — never fake law
├── docs/{legal,architecture,security,operations}/
├── tests/{unit,integration,e2e,security,evaluation}/
├── infrastructure/{docker,terraform,monitoring}/
├── scripts/
└── .github/workflows/
```

Directories are created as their first real file lands — not pre-scaffolded empty.

---

## 12. Database Architecture (core tables, MVP)

`users`, `sessions`, `roles`/`user_roles`, `legal_sources`, `legal_source_versions`,
`legal_sections`, `document_chunks`, `embeddings` (or pgvector column on chunks),
`user_documents`, `user_document_chunks`, `conversations`, `messages`, `citations`,
`retrieval_events`, `audit_logs`, `feedback`, `evaluation_runs`, `evaluation_results`.

Key constraints:

- `legal_sources.jurisdiction`, `authority_level`, `document_type`, `status` are non-null,
  enum-backed.
- `legal_source_versions` carries `effective_date`, `amendment_date`, `superseded_by`
  (self-referential FK) — never overwrite a version in place.
- `document_chunks.source_version_id` FK is mandatory; a chunk cannot exist without a
  version, a version cannot be deleted while referenced.
- `user_documents` and its chunks live in a **separate table family** from
  `legal_sources`/`legal_sections` — enforced at the schema level, not just convention, so
  a bug can't accidentally cite a user's private lease as if it were statute.
- `citations` FK to both a `message` and a `document_chunks`/`user_document_chunks` row —
  never a bare string URL.

Full DDL produced in Phase 4 (Database), not here.

---

## 13. API Architecture

REST, versioned (`/api/v1`), OpenAPI-documented. Domain routers: `auth`, `assistant`,
`search`, `sources`, `rights`, `documents`, `conversations`, `admin`, `health`.
Authorization enforced in service layer (never trust route-level checks alone), every
mutating admin endpoint requires role check + audit log write. Rate limiting via Redis at
the API gateway/middleware layer, tiered (anonymous < authenticated < admin).

---

## 14. Legal Source Architecture

Source registry is the root of trust. Every source record requires: source_id, title,
jurisdiction, issuing_authority, document_type, publication_date, effective_date,
amendment_date, source_url, retrieved_at, version, status, language, authority_level.
Three-tier authority hierarchy (primary legislation/constitution > institutional/agency
guidance > vetted secondary commentary), with secondary sources never silently
overriding primary ones in retrieval ranking or generation.

## 15. Legal Document Pipeline

`SOURCE → FETCH → VALIDATE → STORE ORIGINAL → EXTRACT → NORMALIZE → STRUCTURE → CHUNK →
METADATA → EMBED → INDEX → VALIDATE → PUBLISH`. Immutable original retained in object
storage with checksum; re-ingestion diffs against stored checksum/hash to detect source
changes and avoid duplicate documents. Chunking respects legal hierarchy (Part/Chapter/
Section/Subsection/Schedule) rather than fixed character windows; every chunk retains full
lineage metadata back to its source and version.

## 16. RAG Architecture

`Query → classification → jurisdiction detection → topic detection → hybrid retrieval
(semantic + lexical) → metadata filtering → reranking → context construction → LLM →
citation validation → safety validation → response`. pgvector + Postgres full-text search
for MVP; metadata filters (jurisdiction, authority_level, document_type, status) are
mandatory, not optional, on every retrieval call.

## 17. Citation Architecture

A citation is only emitted when it is backed by an actual retrieved chunk that the
generation step used. Post-generation validation cross-checks every citation marker in
the LLM output against the chunk set that was actually passed into context — citations to
chunks not present in context are stripped and the claim is downgraded to "unverified."

## 18. AI Safety Architecture

Data/instruction separation is structural: retrieved content is wrapped and passed as
labeled data, never concatenated into the system/instruction channel. Defenses required
before Phase 10 ships: prompt injection tests, indirect injection tests (poisoned chunk
content), output validation (no leaking of system prompts, no execution of embedded
instructions), and a documented threat model (THREAT_MODEL.md) covering RAG poisoning,
excessive agency, and insecure tool use, per the OWASP GenAI/LLM guidance in project
knowledge.

## 19. Authentication Architecture

Password hashing (argon2/bcrypt), server-side session/JWT with short-lived access tokens
and refresh rotation, email verification for MVP (or documented deferral), password reset
via time-limited signed tokens, no sensitive data in JWT payloads.

## 20. Authorization Model

Role-based (`user`, `admin`, future `reviewer`), enforced server-side in the service
layer on every request touching another user's data or admin-only resources. Document
ownership checks are mandatory on all `user_documents` endpoints.

## 21. Privacy Architecture

Data minimization by default; conversations retained per user-controlled retention;
uploaded documents encrypted at rest, access-controlled, deletable on request (secure
delete, not soft-delete-only); audit log of access to sensitive records; Nigerian
data-protection posture (NDPR-aware) documented but **not claimed as compliant** until
formally assessed — this gets flagged explicitly in SECURITY.md.

## 22. Threat Model (summary — full doc in Phase 3)

STRIDE-style pass across: authentication/session, document upload (malicious file,
oversized payload, malware), RAG poisoning, prompt injection (direct/indirect), cross-user
data access, admin privilege escalation, dependency supply-chain, secrets exposure,
citation fabrication as a safety failure mode (not just a bug).

## 23. Evaluation Architecture

Versioned evaluation dataset (curated Q&A pairs with expected grounded sources) covering
retrieval (recall/precision/ranking), generation (factuality, groundedness, citation
correctness, refusal quality), and safety (injection resistance, hallucination rate,
leakage). Runs are versioned and diffable across model/prompt/retrieval changes — not a
one-off benchmark.

## 24. Testing Strategy

Unit (services/logic), integration (API + DB), E2E (critical user journeys), security
(auth bypass, injection, upload abuse), evaluation (RAG-specific, see §23). CI gate: no
merge to main without unit+integration passing; security and evaluation suites run on a
schedule + pre-release.

## 25. DevOps Architecture

Docker for local dev parity, docker-compose for full-stack local runs, GitHub Actions for
lint/test/build/security-scan, migrations via a standard tool (Alembic), `.env.example`
kept authoritative, environment separation (dev/staging/prod) documented before any
production deploy.

## 26. Cloud Architecture

Cloud-portable by design (containerized, environment-variable-driven config, S3-compatible
storage abstraction, Postgres-compatible DB). Terraform introduced at deployment phase for
whichever provider is selected — not locked in prematurely. SLIs to define once staging
exists: availability, p95 latency, retrieval success rate, ingestion failure rate.

## 27. Observability Architecture

Structured JSON logs, OpenTelemetry-compatible tracing across API → retrieval → AI
orchestration, metrics on latency/error rate/token usage/citation failure rate/ingestion
failures, privacy-aware logging (no raw legal-question content in logs by default, only
hashed/sampled with consent for eval).

## 28. Cost-Control Strategy

Track token/embedding usage per request; cache frequent retrieval + generation results;
route simple classification tasks to cheaper models where the provider abstraction allows;
rate-limit anonymous usage; monitor cost dashboards from day one of AI integration, not
retrofitted later.

---

## 29. Development Phases

Phase 1 Product spec → Phase 2 Architecture → Phase 3 Repo init → Phase 4 Database →
Phase 5 Auth → Phase 6 Source ingestion → Phase 7 Document processing → Phase 8 RAG
retrieval → Phase 9 Citation engine → Phase 10 AI answer generation → Phase 11 Safety
layer → Phase 12 Legal search → Phase 13 Document Q&A → Phase 14 Rights Explorer →
Phase 15 Frontend → Phase 16 Admin system → Phase 17 Evaluation framework → Phase 18
Security testing → Phase 19 CI/CD → Phase 20 Observability → Phase 21 Deployment →
Phase 22 Production readiness review.

Each phase: objective → files → implementation → tests → review → fix → document →
acceptance criteria → next.

---

## 30. Acceptance Criteria (MVP, restated as a checklist)

- [ ] Auth works end-to-end (register/login/session/reset)
- [ ] Source registry populated with **verified** entries only, full provenance
- [ ] Ingestion pipeline runs end-to-end with checksum-based change detection
- [ ] Retrieval returns filterable, metadata-rich results
- [ ] Every generated citation traces to a real stored chunk
- [ ] Assistant refuses rather than fabricates when evidence is insufficient
- [ ] Prompt injection / indirect injection test suite passes
- [ ] Upload pipeline enforces type/size limits, no execution of uploaded files
- [ ] Document Q&A never conflates user documents with authoritative sources
- [ ] Legal search + Source Explorer functional with full metadata display
- [ ] Rights Explorer covers the initial curated situation set, source-backed
- [ ] Unit/integration/security tests exist and run in CI
- [ ] Evaluation framework produces retrieval + generation + safety scores
- [ ] Deployable via Docker/CI, secrets externalized, no secrets in VCS
- [ ] Basic monitoring/logging in place
- [ ] Core docs (README, ARCHITECTURE, SECURITY, THREAT_MODEL, DATABASE, API) exist and
      match the actual system

---

## 31. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Fabricated legal citations | Structural citation validation against retrieved chunks only |
| Sparse Nigerian legal corpus at launch | Explicit "insufficient evidence" refusal path; scope Rights Explorer to what's actually sourced |
| Prompt injection via poisoned/uploaded documents | Data/instruction channel separation; injection test suite |
| Users mistaking output for legal advice | Persistent disclaimers, escalation prompts on high-risk queries |
| Outdated law presented as current | Mandatory status/effective-date surfacing, versioned sources |
| Cross-user data leakage | Server-side authz, table-level separation of user docs vs. corpus |
| Cost overrun from unmetered AI usage | Token/cost tracking + caching + rate limiting from day one |
| NDPR non-compliance assumed rather than verified | Explicit "not yet assessed" flag in SECURITY.md until a real assessment happens |

## 32. Knowledge Gaps (must be resolved before/at relevant phase)

- Exact initial source list (which Acts, which agencies) — needs a verified list before
  Phase 6, not invented.
- Chosen AI model provider(s) and their current API/pricing (verify at Phase 8/10 —
  do not rely on possibly-stale training knowledge).
- Target cloud provider for Terraform (Phase 21).
- NDPR compliance requirements in detail — needs actual legal/compliance review, not
  assumed from general knowledge.
- Malware-scanning solution for uploads (specific tool TBD at Phase 16/upload hardening).

## 33. Required Authoritative Legal Sources (initial candidate list — to be verified, not assumed)

Priority 1 candidates: Constitution of the Federal Republic of Nigeria 1999 (as amended),
relevant Acts of the National Assembly (e.g. Nigeria Police Act, Labour Act, Consumer
Protection framework, Nigeria Data Protection Act), official Gazette publications.
Priority 2: relevant regulatory agency publications (e.g. NDPC, CAC, FCCPC) and official
procedural guidance. Priority 3: vetted secondary legal commentary, clearly labeled.
**None of these are ingested as fact until independently fetched and verified per §7/§34 —
this list is a starting research target, not a pre-approved corpus.**

## 34. Recommended First Implementation Milestone

**Phase 3 + Phase 4 combined**: repository scaffold (only the directories needed for
Phase 3–5 work, not the full tree) + database schema/migrations for the core MVP tables
(`users`, `legal_sources`, `legal_source_versions`, `legal_sections`, `document_chunks`,
`conversations`, `messages`, `citations`). This unblocks both auth (Phase 5) and a real,
verifiable first source ingestion (Phase 6) without speculative work on RAG/AI layers
before there's real data to retrieve.

---

**End of Master Build Plan. No application code has been written. Awaiting review and a
BUILD PHASE command.**
