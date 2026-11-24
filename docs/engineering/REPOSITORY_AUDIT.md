# LegalLens — Repository Audit (Stage 1, read-only)

- **Date:** 2026-11-23
- **Repo:** `Dammyy-22/legal_lens`, branch `main`, single commit `9bebfca` ("latest-add"), 443 tracked files
- **Scope of this audit:** reconnaissance only. No application code was modified. `.env*` files were not read.
- **Status:** first-pass audit. Items marked *unverified* need a second look before Stage 2.

## 1. Architecture as found

| Layer | Implementation |
|---|---|
| Frontend | Next.js 16.3.4 / React 18 App Router in `apps/web` (Vercel) |
| Auth | Supabase Auth (email/password, Google OAuth); `proxy.ts` refreshes session; dashboard layout and admin page re-check `getUser()` |
| Data | Supabase Postgres + pgvector (`vector(1536)`), RLS on all tables |
| Backend | Supabase Edge Functions (Deno): `ask`, `legal`, `draft-document`, `create-user-document-upload`, `process-user-document`, `ask-user-document`; shared wrapper `_shared/openrouter.ts` |
| AI | OpenRouter only. Chat default `openai/gpt-4.1-mini`; embeddings default `openai/text-embedding-3-small`. Ingestion scripts use `OPENAI_API_KEY` directly |
| OCR | Python gateway `services/unlimited-ocr-gateway` calling a self-hosted Baidu Unlimited-OCR vLLM endpoint (max 10 OCR pages/doc) |
| Corpus | Normalised/chunked Nigerian instruments under `scripts/ingestion/normalized-corpus`: Constitution 1999, Police Act 2020 (+PLAC comparison), Labour Act, FCCPA 2018, Lagos State Road Traffic Law, DCRMA compendium, RC compendium, "Roles, Rights, Responsibilities under new Police Act" |
| CI | `.github/workflows/ci.yml`: web build, `deno check` of 5 functions, 3 node test files, schema + user-documents migration against pgvector Postgres |

Retired: FastAPI/Alembic backend (documented in README; `DECISIONS.md` still describes it).

## 2. Request flows (as implemented)

**`ask`:** JWT check → length validation → in-memory rate limit → English regex risk triage (fixed reply) → embed question → `match_document_chunks` (threshold 0.72, 6 chunks) → fallback to `search_verified_document_chunks` (Postgres FTS) → refuse if empty → grounded generation with `[[cite:REF]]` tags → drop citation IDs not in retrieved set → persist → respond.

**`ask-user-document`:** JWT check → owner-scoped document lookup → embed question → `match_user_document_chunks` (SECURITY DEFINER; checks `auth.uid()` owns a `ready` document) → generate → validate → store question and sources.

**`process-user-document`:** JWT check → service-role lookup constrained to `owner_id = user.id` → atomic claim (`uploaded|failed → processing`) → download → type/signature/size checks → extract → optional OCR → chunk → embed → store.

## 3. What is working well (evidence-based)

- Every function verifies the JWT server-side; RLS enabled on all corpus, conversation and user-document tables.
- Verified-only corpus enforced in RLS **and** in function code; admin read of unverified rows derives from `app_metadata` (not user-editable `user_metadata`).
- Private-document design is careful: owner-bound rows, composite FKs tying citations to same-document chunks, quota trigger with advisory lock, private bucket with folder-per-user policies, signed upload tokens, MIME/signature/size checks.
- Retrieved text is escaped and fenced as data; prompt rule 6 states sources are data, not instructions.
- OCR gateway uses constant-time key comparison and minimum 32-char key.
- Honest-by-design refusal when retrieval is empty, and an excerpt-only fallback on provider 429.

## 4. Verification actually run (this audit)

| Command | Result |
|---|---|
| `node --test` on `ask`, `process-user-document`, `ask-user-document` logic tests | 16/16 pass |
| `node --test scripts/ingestion/constitution-structure.test.mjs` | 4/4 pass |
| `npm ci` in `apps/web` | succeeds (376 packages) |
| `npx tsc --noEmit` in `apps/web` | exit 0 |
| `next build` (dummy public Supabase env) | exit 0, 20 pages generated |
| `npm run lint` (`next lint`) | **fails** — exit 1, "Invalid project directory …/apps/web/lint" |
| `npm audit --omit=dev` | **1 critical (next), 2 high (sharp, source-map-js)**; fixes available |
| Pattern scan of tracked files for API keys/JWTs/private keys | no matches |

**Not run:** `deno check` and Deno tests (Deno not installed in the audit sandbox), OCR gateway Python tests (PyMuPDF not installed in sandbox — an environment gap, not a repo defect), SQL migrations against Postgres, live provider calls, any hosted-Supabase inspection.

## 5. Findings summary

See `ISSUE_REGISTER.md` for IDs, priority, evidence and status. Headlines:

1. **Dependency exposure** — installed Next.js 16.3.4 is inside the audited vulnerable range (LL-001).
2. **Provider data policy not enforced** — OpenRouter requests send no `provider` data-policy block, so routing defaults to providers that may store or train on data; private document content is in scope (LL-002).
3. **Cost-abuse surface** — document functions have no rate limiting; `ask`/`draft-document` limit only per warm isolate (LL-003).
4. **Quality gates are thin** — lint is broken, several tests and migrations are outside CI, no authorization/RLS or retrieval/citation evaluation tests (LL-004, LL-005, LL-016).
5. **Citation verification is ID-level only** (LL-007).
6. **Repo hygiene** — no root `CLAUDE.md`, stale `DECISIONS.md`, committed `supabase/.temp`, stray files, committed raw corpus (LL-010, LL-011).

## 6. Unknowns (must be resolved before or during Stage 2)

- Hosted Supabase settings: MFA for admins, inactivity timeout, refresh-token reuse detection, email confirmation, password policy.
- OpenRouter account-level privacy settings (ZDR/data-collection toggles) — may already mitigate LL-002.
- Which corpus rows are `verified` in production, and which Police Act chunk version (`chunks`, `chunks-v2`, `chunks-v4`) was ingested.
- ~~Whether a consent/disclosure step exists~~ **Corrected:** a client-side checkbox exists on the Documents and Drafting pages (my first search missed `.tsx` files); it was not enforced or recorded server-side — see LL-020 (the page was not read in full).
- Content of `docs/operations/deployment-checklist.md` "provider disclosure" section.
- Full text of `legal`, `create-user-document-upload` and `apps/web` pages beyond what is cited here.
- Rights to redistribute the committed corpus texts (PLAC and other compilations).
- Hosting: Vercel-managed or self-hosted Next.js (affects which Next advisories are reachable).
