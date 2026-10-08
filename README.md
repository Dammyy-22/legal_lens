# LegalLens AI

AI-powered legal information and rights-assistance platform. Initial jurisdiction: Nigeria.

**LegalLens is a legal-information and legal-literacy tool. It is not a lawyer and does
not provide legal advice.** See `AI_SAFETY.md` (where present) and the assistant's own
system prompt in `supabase/functions/ask/index.ts` for how this is enforced in practice.

## Architecture (current, as of this update)

**Fully Supabase-native.** No separate backend server to host or deploy.

- **Frontend:** Next.js on Vercel (`apps/web/`)
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Database:** Supabase Postgres + pgvector, with Row Level Security as the
  enforcement layer for "only verified legal content is visible"
- **Backend logic:** Supabase Edge Functions (Deno/TypeScript) — `supabase/functions/`
- **AI:** OpenAI for embeddings, Anthropic Claude for grounded answer generation

FastAPI (a Python backend that existed earlier in this project's history) has been
**retired and removed**. It was briefly revived with Supabase-JWT verification in a
separate work session, which is documented in `DECISIONS.md` as a real architectural
detour — that code has now been ported to Edge Functions and the FastAPI code deleted
to avoid maintaining two backend runtimes long-term. If you see references to
`apps/api` in old commits or docs, that's why.

## Status

| Area | Status |
|---|---|
| Auth | Supabase Auth (email/password, Google OAuth), full profile fields at signup |
| Dashboard | Sidebar/hamburger nav, avatar+name (not email) shown per product decision |
| Legal search | `supabase/functions/legal` — keyword search over verified corpus |
| Constitution browse | Same function, `mode=constitution` |
| AI Assistant (Ask) | `supabase/functions/ask` — retrieval + Claude generation + citation validation. Type-checked and unit-tested; **not yet run end-to-end against live Supabase/OpenAI/Anthropic** — needs real credentials, which this build environment doesn't have |
| Legal corpus | Constitution of Nigeria — ingestion scripts exist (`scripts/ingestion/`); **nothing is verified/published yet** until a human reviews and flips `verified = true` |
| Lawyers | Sample profiles (clearly labeled, not real) + a real waitlist signup |
| My documents | Private PDF/DOCX/TXT upload, text extraction, embeddings, and selected-document Q&A with page/section citations; no OCR |

See `DECISIONS.md` for the full history of what's been verified vs. assumed, including
several real bugs found by actually testing things rather than just reading code.

## Local development

### Prerequisites
- Node.js 22 (web app)
- Deno 2.x (for local Edge Function development — `supabase functions serve`)
- A Supabase project (or the Supabase CLI's local dev stack via `supabase start`)

### Web app
```bash
cd apps/web
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev   # http://localhost:3000
```

### Database setup (Supabase Dashboard → SQL Editor, in order)
1. `database/schema.sql` — legal corpus, conversations, messages, citations, RLS,
   and the `match_document_chunks` vector search function
2. `database/waitlist_migration.sql` — lawyer referral waitlist table
3. `database/user_documents_migration.sql` — private user uploads, document Q&A,
   owner-scoped policies, quota trigger, and retrieval RPC

### Populating the legal corpus
See `scripts/ingestion/README.md`. **Nothing ingested is visible to the app until you
manually verify it** — this is enforced by RLS, not just a suggestion.

### Deploying Edge Functions
```bash
supabase functions deploy ask
supabase functions deploy legal
supabase functions deploy create-user-document-upload
supabase functions deploy process-user-document
supabase functions deploy ask-user-document
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Apply `database/schema.sql`, `database/waitlist_migration.sql`, and
`database/user_documents_migration.sql` in that order in the Supabase SQL Editor
before deploying the document functions. The additive user-document migration
creates the private bucket, owner-only RLS policies, upload quotas, and
document-scoped retrieval RPC. See
`docs/operations/deployment-checklist.md` for the staging checks and provider
disclosure details. Scanned PDFs are not OCR'd.

## Repository structure

```
apps/web/            Next.js frontend
supabase/functions/  Edge Functions (ask, legal) — all backend logic lives here
database/            SQL schema + migrations for Supabase Postgres
scripts/ingestion/   One-off scripts to fetch/chunk/embed legal source documents
```

## Key docs
- `PROJECT_SPEC.md` — original product definition
- `DATABASE.md` — schema design and what's been tested
- `SECURITY.md` — security posture and known gaps
- `DECISIONS.md` — the real history: what was verified, what was assumed, what
  changed and why, including architectural detours and how they were resolved
- `docs/architecture/system-map.md` — runtime architecture and request flow
- `docs/operations/backend-hardening.md` — request validation and guardrails
- `docs/operations/ai-assistant-reliability.md` — grounded-answer workflow and eval
  plan
- `docs/operations/admin-review-workflow.md` — admin verification/rejection process
- `docs/operations/deployment-checklist.md` — production deployment gate
- `scripts/validation/supabase-e2e-smoke.mjs` — live Supabase smoke test for ask/legal endpoints
- `scripts/validation/admin-review-flow.mjs` — live admin approval/rejection workflow smoke test
- `supabase/functions/ask/logic.test.mjs` — automated validation for citation extraction and rate limiting
