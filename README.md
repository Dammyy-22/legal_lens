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

### Populating the legal corpus
See `scripts/ingestion/README.md`. **Nothing ingested is visible to the app until you
manually verify it** — this is enforced by RLS, not just a suggestion.

### Deploying Edge Functions
```bash
supabase functions deploy ask
supabase functions deploy legal
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

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
