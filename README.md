# LegalLens AI

AI-powered legal information and rights-assistance platform. Initial jurisdiction: Nigeria.

**LegalLens is a legal-information and legal-literacy tool. It is not a lawyer and does
not provide legal advice.** See `AI_SAFETY.md` (where present) and the assistant's own
system prompt in `supabase/functions/ask/index.ts` for how this is enforced in practice.

## Architecture (current, as of this update)

**Supabase-native application backend.** A private OCR adapter is additionally
required only when enabling scanned-PDF processing; the Baidu model itself runs
on a separately hosted GPU service.

- **Frontend:** Next.js on Vercel (`apps/web/`)
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Database:** Supabase Postgres + pgvector, with Row Level Security as the
  enforcement layer for "only verified legal content is visible"
- **Backend logic:** Supabase Edge Functions (Deno/TypeScript) —
  `supabase/functions/`; scanned-PDF adaptation in `services/unlimited-ocr-gateway/`
- **AI:** OpenRouter for runtime embeddings and grounded generation; optional OpenAI ingestion tooling for corpus preparation

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
| Legal search | `supabase/functions/legal` — keyword search over verified corpus with jurisdiction, source-type, and authority filters |
| Constitution browse | Same function, `mode=constitution` |
| AI Assistant (Ask) | `supabase/functions/ask` — verified-source retrieval, scenario-focused generation, citation validation, and a clearly labeled source-excerpt fallback when model providers are unavailable |
| Legal corpus | Constitution of Nigeria — verified/current corpus content is searchable; new or re-extracted legal content must be reviewed before publication |
| Lawyers | Sample profiles (clearly labeled, not real) + a real waitlist signup |
| My documents | Private PDF/DOCX/TXT upload, Baidu Unlimited-OCR for scanned PDF pages, embeddings, and selected-document Q&A with page/section citations |
| Document review | Guided key-term, date, payment-term, and lawyer-question prompts over retrieved document passages |
| Matters & tasks | Private owner-scoped matter organizer for user-entered tasks and dates; dates are not legal deadline calculations |
| Case-law research | Outbound NigeriaLII search and court index; judgments are not imported into or verified by LegalLens |

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
4. `database/matter_management_migration.sql` — private matters and user-entered
   task dates with owner-scoped row-level security

### Populating the legal corpus
See `scripts/ingestion/README.md`. **Nothing ingested is visible to the app until you
manually verify it** — this is enforced by RLS, not just a suggestion.

### Deploying Edge Functions
```bash
supabase functions deploy ask
supabase functions deploy draft-document
supabase functions deploy legal
supabase functions deploy create-user-document-upload
supabase functions deploy process-user-document
supabase functions deploy ask-user-document
supabase secrets set OPENROUTER_API_KEY=your-openrouter-key
supabase secrets set OPENROUTER_MODEL=openai/gpt-4.1-mini OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
```

`OPENROUTER_API_KEY` is used server-side for chat generation and embeddings in
the `ask`, document-processing, document-Q&A, and `draft-document` Edge
Functions. `OPENROUTER_MODEL` optionally selects the chat model (default:
`openai/gpt-4.1-mini`); `OPENROUTER_EMBEDDING_MODEL` optionally selects the
embedding model (default: `openai/text-embedding-3-small`, which must return
1536 dimensions to match the database index). Corpus ingestion scripts may
continue to use `OPENAI_API_KEY`. Never put provider keys in `NEXT_PUBLIC_*`
variables or the Next.js web app environment.

Apply `database/schema.sql`, `database/waitlist_migration.sql`, and
`database/user_documents_migration.sql` in that order in the Supabase SQL Editor
before deploying the document functions. The additive user-document migration
creates the private bucket, owner-only RLS policies, upload quotas, and
document-scoped retrieval RPC. Scanned pages are OCR'd by the authenticated
Unlimited-OCR gateway in `services/unlimited-ocr-gateway/`; deploy it beside a
Baidu Unlimited-OCR vLLM server and configure the gateway secrets described in
`docs/operations/deployment-checklist.md`. See
`docs/operations/deployment-checklist.md` for the staging checks and provider
disclosure details.

## Repository structure

```
apps/web/            Next.js frontend
supabase/functions/  Supabase Edge Functions for app APIs and document processing
services/            Private Baidu Unlimited-OCR PDF-rendering gateway
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
