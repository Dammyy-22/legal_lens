# LegalLens — Security & Database Audit

## 1. Scope & Limitations
- **Scope:** Authentication, authorization, Supabase RLS & Storage policies, all 6 Edge Functions, Python OCR gateway, file-upload parsing, secrets & git history, HTTP security headers, OWASP Top 10, and Postgres schema/indexes/integrity.
- **Limitations:** Strictly read-only static audit + local header/bundle inspection. Live penetration tests against the remote Supabase project (live cross-user JWT replay, Storage path-normalization behavior, Supabase Auth rate-limit config, and remote Postgres `pg_policies` drift check) are **NOT VERIFIED** pending an authorized isolated staging instance. Local Docker execution was blocked by sandbox permissions on `C:\Users\hp\.docker\config.json`.

---

## 2. Verified Security Strengths (Evidence-Backed)
1. **Admin RBAC uses `app_metadata.role` (not user-editable `user_metadata`):** Enforced in RLS (`database/schema.sql:407,412,421`) and server component (`apps/web/app/dashboard/admin/page.tsx:19`).
2. **Server-side auth verification in middleware & layout:** Both `apps/web/proxy.ts:29-31` and `apps/web/app/dashboard/layout.tsx:11-13` call `supabase.auth.getUser()` rather than trusting unverified cookie/session claims.
3. **Open redirect protection:** `apps/web/lib/safe-redirect.ts` rejects protocol-relative `//`, backslashes, control chars, and non-matching origins; used by `auth/callback/route.ts` and `auth/login/page.tsx`.
4. **Server-enforced, append-only consent log:** `database/user_consent_migration.sql` + `supabase/functions/_shared/consent.mjs` fail closed (`403`/`503`) for private documents and drafting; verified by two-user SQL tests in `database/tests/user_consent_test.sql`.
5. **No secrets in Next.js client bundle or git history:** Scanning all 34 compiled JS chunks under `apps/web/.next/static` found `0` occurrences of `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `SUPABASE_PUBLISHABLE_KEY`, or `'service_role'`. Git history search for `eyJhbGci`, `sk-or-v1`, `sk-proj-` returned `0` commits.
6. **OCR gateway constant-time auth & pixel-bomb guard:** `services/unlimited-ocr-gateway/gateway.py:97-101, 196` uses `hmac.compare_digest` and caps rendered page pixels at `30,000,000`.
7. **Baseline security headers configured:** Verified live on `next start`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=31536000`.

---

## 3. Supabase RLS & Table Security Matrix

| Table | RLS On? | Policies / Grants | Verdict | Issues |
|---|---|---|---|---|
| `legal_sources` | Yes | `SELECT` to `authenticated` `USING (true)` | **PARTIAL** | Leaks titles/URLs of unverified/rejected sources (`SEC-08`) |
| `legal_source_versions` | Yes | `SELECT` `verified = true`; Admin `SELECT`/`UPDATE` via `app_metadata.role = 'admin'` | **PARTIAL** | `SELECT` does not filter `status = 'current'`; Admin `UPDATE` allows arbitrary `verified_by` spoofing (`SEC-09` / `SEC-10`) |
| `legal_sections` | Yes | `SELECT` where version `verified = true` (or admin) | **PASS (static)** | Properly scoped to verified versions |
| `document_chunks` | Yes | `SELECT` where version `verified = true` | **PARTIAL** | `match_document_chunks` RPC omits `status = 'current'` & has no `match_count` cap (`SEC-02`, `RAG-01`) |
| `rate_limit_events` | Yes | `ALL` to `service_role` only | **PASS (static)** | Missing index (`DB-01`); never queried to enforce caps (`SEC-03`) |
| `conversations` | Yes | `ALL` to `authenticated` `auth.uid() = user_id` | **PASS (static)** | Owner-scoped; missing index (`DB-01`) |
| `messages` | Yes | `ALL` to `authenticated` via conversation ownership | **FAIL** | Allows client `INSERT`/`UPDATE`/`DELETE` of arbitrary `role='system'`/`'assistant'` rows (`SEC-04`) |
| `citations` | Yes | `SELECT` only via message/conversation ownership | **FAIL** | No `INSERT` policy; `ask/index.ts` writes fail silently (`FUN-01`) |
| `user_documents` | Yes | `SELECT`/`INSERT`/`DELETE` to `authenticated` (`owner_id = auth.uid()`); quota trigger (`20`) | **FAIL** | Direct client `INSERT` allows arbitrary `storage_path` without path-traversal CHECK (`SEC-01`) |
| `user_document_chunks` | Yes | `SELECT` to `authenticated` (`owner_id = auth.uid()`) | **PASS (static)** | Writes restricted to `service_role`; `match_user_document_chunks` checks `auth.uid()` & owner |
| `user_document_questions` | Yes | `SELECT` to `authenticated` (`owner_id = auth.uid()`) | **PASS (static)** | Writes restricted to `service_role` |
| `user_document_answer_sources` | Yes | `SELECT` to `authenticated` (`owner_id = auth.uid()`) | **PASS (static)** | Composite FK enforces same `(document_id, owner_id)` |
| `legal_matters` | Yes | `ALL` to `authenticated` (`owner_id = auth.uid()`) | **PASS (static)** | Owner-scoped with CHECK constraints & index |
| `legal_matter_tasks` | Yes | `ALL` to `authenticated` (`owner_id = auth.uid()` + parent matter owner check) | **PASS (static)** | Strong composite FK + RLS |
| `user_consent_events` | Yes | `SELECT` to `authenticated` (`user_id = auth.uid()`); writes via `grant_consent`/`withdraw_consent` RPCs | **PASS** | Verified by 2-user SQL test design |
| `lawyer_waitlist` | Yes | `INSERT` to `authenticated` (`auth.uid() = user_id`); write-only | **PASS (static)** | No `SELECT` leaks; consider length CHECK on `email`/`practice_area` |
| `storage.objects` (`user-documents`) | Yes | Private bucket; `SELECT`/`DELETE` where `foldername[1] = auth.uid()`; uploads via signed URLs | **PASS (static)** | Direct client uploads disabled; relies on `create-user-document-upload` |

---

## 4. Edge Function API Security Matrix

| Edge Function | JWT Auth | Ownership / Consent | Input Validation | Rate Limit | CORS | Verdict |
|---|---|---|---|---|---|---|
| `ask` | Yes (`getUser`) | Missing consent check (`SEC-07`); trusts `conversation_id` without ownership verify | Question 3..2000; no body-size check | In-memory Map only (unbounded, per-isolate) (`SEC-03`) | `*` (`SEC-06`) | **FAIL** |
| `legal` | Yes (`getUser`) | RLS verified-only | `q` 2..500, enum filters | **None** (`SEC-03`) | `*` (`SEC-06`) | **FAIL** |
| `create-user-document-upload` | Yes (`getUser`) | `checkConsent` | MIME/ext/size <=15MB; `content-length` header check only | **None** (`SEC-03`) | `*` (`SEC-06`) | **PARTIAL** |
| `process-user-document` | Yes (`getUser`) | Owner check + `checkConsent`; weak `storage_path.startsWith` (`SEC-01`) | UUID, magic bytes, DOCX size header check (`SEC-05`), `content-length` header only | **None** (`SEC-03`) | `*` (`SEC-06`) | **FAIL** |
| `ask-user-document` | Yes (`getUser`) | Owner check + RPC owner check + `checkConsent` | UUID, question 3..2000, `content-length` header only | **None** (`SEC-03`) | `*` (`SEC-06`) | **PARTIAL** |
| `draft-document` | Yes (`getUser`) | `checkConsent` | Enum, facts 30..4000, recipient <=120, `content-length` header only | In-memory Map (5/min per isolate) (`SEC-03`) | `*` (`SEC-06`) | **PARTIAL** |

---

## 5. Security & Database Findings

#### `SEC-01` — Potential Cross-User Storage Path Traversal & Direct `user_documents` Insertion
- **Severity:** HIGH *(escalates to CRITICAL if Supabase Storage normalizes `..` on `service_role` downloads)* | **Category:** Authorization / IDOR | **Confidence:** High
- **Affected Files:** `database/user_documents_migration.sql:112, 126-129`, `supabase/functions/process-user-document/index.ts:123-135`
- **Evidence:** Authenticated users are granted direct `INSERT` on `public.user_documents` (`with check (auth.uid() = owner_id and processing_status = 'uploaded')`) with no CHECK constraint restricting `storage_path` format. In `process-user-document/index.ts:127-134`, only `!document.storage_path.startsWith(\`${user.id}/\`)` is checked before downloading via `service.storage.from('user-documents').download(document.storage_path)` (which bypasses Storage RLS).
- **Reproduction:** As User B, call PostgREST `POST /rest/v1/user_documents` with `owner_id = <B>`, `storage_path = "<B>/../<A>/<docId>.pdf"`, `processing_status = "uploaded"`, then invoke `POST /functions/v1/process-user-document`. Even if Storage rejects `..`, direct INSERT bypasses `create-user-document-upload` validation and lets users forge metadata (`mime_type`, `file_size_bytes`).
- **Impact:** Potential cross-user private document exfiltration via `service_role` storage download; bypass of upload reservation workflow.
- **Likelihood:** Medium
- **Recommendation:** (1) Revoke direct `INSERT` on `user_documents` from `authenticated` (perform inserts via `service_role` inside `create-user-document-upload` after quota/ownership checks), (2) add a DB CHECK constraint `storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx|txt)$'`, and (3) enforce exact match `document.storage_path === \`${user.id}/${document.id}.${ext}\`` in `process-user-document`.

#### `SEC-02` — Unbounded `SECURITY DEFINER` Vector RPC Allows Full-Corpus Dump & Stale-Law Leakage
- **Severity:** HIGH | **Category:** API / Database Security | **Confidence:** High
- **Affected File:** `database/schema.sql:240-281`
- **Evidence:** `public.match_document_chunks(query_embedding, match_threshold, match_count)` is `SECURITY DEFINER`, granted to `authenticated`, has **no bounds check** on `match_count` or `match_threshold` (unlike `match_user_document_chunks` which enforces `1..10`), and omits `and v.status = 'current'`.
- **Reproduction:** As any authenticated user, invoke PostgREST `POST /rest/v1/rpc/match_document_chunks` with `match_threshold: -1, match_count: 100000` and a dummy 1536-dim zero vector.
- **Impact:** Bulk extraction of all chunks (including repealed/superseded versions if `verified = true`) and DB CPU/memory exhaustion.
- **Likelihood:** High
- **Recommendation:** Add `if match_count < 1 or match_count > 20` and `match_threshold between -1 and 1` guards, plus `and v.status = 'current'`.

#### `SEC-03` — Missing Rate Limiting on Costly Endpoints & Non-Distributed Per-Isolate Rate Limiting
- **Severity:** HIGH | **Category:** API Security / DoS / Cost Abuse | **Confidence:** High
- **Affected Files:** `supabase/functions/ask/index.ts:37-38, 116-131, 442-465`, `draft-document/index.ts:14-16, 51-67`, `ask-user-document/index.ts`, `process-user-document/index.ts`, `create-user-document-upload/index.ts`, `legal/index.ts`
- **Evidence:** Four Edge Functions (`ask-user-document`, `process-user-document`, `create-user-document-upload`, `legal`) have **zero rate limiting**. `ask` and `draft-document` rely on in-memory `Map` objects that reset on cold start and are not shared across Deno isolates; `ask/index.ts:442-465` only *inserts* into `rate_limit_events` without ever querying it to enforce limits, and never evicts expired keys from `RATE_LIMIT_BUCKETS`.
- **Reproduction:** Issue rapid concurrent requests from one account to `ask-user-document` or `process-user-document`, or hit multiple cold Edge isolates on `/ask`.
- **Impact:** Unlimited OpenRouter billing exhaustion, OCR GPU saturation, and Postgres load DoS by a single authenticated user.
- **Likelihood:** High
- **Recommendation:** Implement atomic DB-backed (or Upstash Redis) sliding-window rate limiting + daily per-user token/request budgets enforced across all 6 Edge Functions.

#### `SEC-04` — Authenticated Users Can Mutate/Forge `assistant` and `system` Rows in `public.messages`
- **Severity:** HIGH | **Category:** Authorization / Data Integrity | **Confidence:** High
- **Affected File:** `database/schema.sql:203-216`
- **Evidence:** Policy `"Users access messages in their own conversations"` grants `for all to authenticated` (SELECT, INSERT, UPDATE, DELETE) on `public.messages`, and `role` permits `('user', 'assistant', 'system')` (line 126).
- **Reproduction:** As an authenticated user, call PostgREST `POST /rest/v1/messages` with `role: 'system'` or `role: 'assistant'` targeting one of your own `conversation_id`s.
- **Impact:** Users can forge fake LegalLens AI legal advice transcripts under their account, and as soon as multi-turn history loading is added to `/ask`, attackers can inject persistent `system` prompts into conversation memory.
- **Likelihood:** High
- **Recommendation:** Restrict `authenticated` to `SELECT` (and optionally `DELETE` on `conversations` only) on `messages`, moving all `messages` inserts to `service_role` inside `ask/index.ts` after ownership verification.

#### `SEC-05` — DOCX Zip-Bomb Bypass, Missing Chunked-Body Size Enforcement & OCR Gateway Slowloris Risk
- **Severity:** MEDIUM | **Category:** File Upload Security / DoS | **Confidence:** High
- **Affected Files:** `supabase/functions/process-user-document/logic.mjs:68-128`, `process-user-document/index.ts:50, 289`, `ask-user-document/index.ts:27`, `draft-document/index.ts:21`, `services/unlimited-ocr-gateway/gateway.py:257, 287`
- **Evidence:**
  1. `validateDocxArchiveSize` checks only the attacker-controlled ZIP central-directory `uncompressedSize` uint32 header before calling `unzipSync(bytes)` (no streaming byte cap during inflate, no ZIP64 handling).
  2. Edge Functions check `Number(request.headers.get('content-length') ?? 0) > ...`, which evaluates to `0` on `Transfer-Encoding: chunked` requests with no `Content-Length` header.
  3. `gateway.py:287` uses stdlib `ThreadingHTTPServer` with no max-concurrency semaphore and no socket timeout on `self.rfile.read(content_length)`.
  4. No antivirus/malware scanning exists on uploaded user files.
- **Reproduction:** Craft a ZIP with forged central directory `uncompressedSize = 100` compressing 100 MB of zeroes; or send chunked POST bodies without `Content-Length`.
- **Impact:** Edge Function OOM crashes and OCR gateway thread/memory exhaustion.
- **Likelihood:** Medium
- **Recommendation:** Pass a streaming filter/size-cap callback to `fflate` (only decompress `word/document.xml` up to `MAX_EXTRACTED_CHARACTERS * 4` bytes), enforce body size while reading `request.text()`/`arrayBuffer()`, and run OCR gateway behind a reverse proxy + bounded worker pool (e.g., Gunicorn/Uvicorn with timeouts and concurrency cap).

#### `SEC-06` — Missing Content-Security-Policy (CSP), Wildcard Edge CORS (`*`), and `X-Powered-By` Disclosure
- **Severity:** MEDIUM | **Category:** Web / API Security | **Confidence:** High
- **Affected Files:** `apps/web/next.config.js:17-37`, all 6 `supabase/functions/*/index.ts` (`Access-Control-Allow-Origin: '*'`)
- **Evidence:** Live response headers from `next start` confirmed **no `Content-Security-Policy` header** and exposed `x-powered-by: Next.js`. All 6 Edge Functions return `Access-Control-Allow-Origin: '*'`.
- **Reproduction:** `curl -I http://127.0.0.1:3111/` -> observe missing CSP and `x-powered-by: Next.js`.
- **Impact:** Reduced defense-in-depth against XSS and cross-origin token abuse if any script injection occurs.
- **Likelihood:** Medium
- **Recommendation:** Add a strict `Content-Security-Policy` header and `poweredByHeader: false` in `next.config.js`; restrict Edge Function `Access-Control-Allow-Origin` to an allowlist via env var (`ALLOWED_ORIGINS`).

#### `SEC-07` — Missing Consent Gate on `/ask` & Client-Only Password Policy
- **Severity:** MEDIUM | **Category:** Privacy & Auth Policy | **Confidence:** High
- **Affected Files:** `supabase/functions/ask/index.ts`, `apps/web/app/auth/register/page.tsx:30-36`, `supabase/config.toml`
- **Evidence:** Unlike `draft-document` and private document functions, `/ask` sends user questions to OpenRouter without calling `checkConsent(...)`. Meanwhile, the 10-character mixed password policy exists only in React client code (`register/page.tsx`, `reset-password/page.tsx`, `settings/page.tsx`); `supabase/config.toml` specifies no `[auth.password]` constraints.
- **Reproduction:** Call `/functions/v1/ask` without any `user_consent_events` row -> succeeds. Register directly via Supabase Auth REST API with a 6-character password -> bypasses frontend validation if Supabase dashboard retains defaults.
- **Impact:** Privacy/NDPA consent gap for general AI Q&A; weak passwords allowed via direct API calls.
- **Likelihood:** Medium
- **Recommendation:** Add an `ai_legal_qa` consent purpose (or clear disclosure + opt-in) if required by privacy policy, and configure minimum password length & character requirements in `supabase/config.toml` and Supabase Auth dashboard.

#### `SEC-08` — `legal_sources` `USING (true)` Leaks Unverified/Rejected Metadata & SQL `LIKE` Wildcard Injection in FTS Fallback
- **Severity:** MEDIUM | **Category:** Database Security | **Confidence:** High
- **Affected Files:** `database/schema.sql:160-161, 365`, `database/lexical_search_migration.sql:83`
- **Evidence:** `legal_sources` SELECT policy uses `using (true)` (exposing unverified/rejected source titles/URLs to all authenticated users). `search_verified_document_chunks` executes `or lower(dc.text) like '%' || lower(trim(query_text)) || '%'` without escaping `%` or `_` metacharacters — passing `"%%"` matches every single verified chunk in the database via full table scan.
- **Reproduction:** Call `rpc('search_verified_document_chunks', { query_text: '%%', match_count: 20 })` as an authenticated user.
- **Impact:** Metadata disclosure of unverified corpus rows; full-scan DoS and wildcard bypass in lexical fallback.
- **Likelihood:** Medium
- **Recommendation:** Scope `legal_sources` SELECT policy with `exists (select 1 from legal_source_versions v where v.source_id = id and v.verified = true and v.status = 'current')` (plus admin override), and escape `%`, `_`, `\` before `LIKE` (or drop the `LIKE` fallback in favor of indexed `websearch_to_tsquery`).

#### `SEC-09` — Sensitive Env Keys in `apps/web/.env.local` & Tracked `supabase/.temp/*` Metadata
- **Severity:** LOW | **Category:** Secrets Hygiene | **Confidence:** High
- **Affected Files:** `apps/web/.env.local` (untracked, inspected key names only), `supabase/.temp/*` (tracked in git)
- **Evidence:** `apps/web/.env.local` contains `SUPABASE_SERVICE_ROLE_KEY` and **two duplicate `OPENAI_API_KEY` entries** right above its own warning comment ("Never put the service_role key here..."). `apps/web` code never reads `SUPABASE_SERVICE_ROLE_KEY`, so its presence in the frontend `.env.local` creates accidental exposure risk. Separately, 9 files in `supabase/.temp/` (`project-ref`, `pooler-url`, `linked-project.json`) are committed in git (`hasEmbeddedCreds=False`, but expose internal project ref/pooler hostname).
- **Reproduction:** Inspect key names in `apps/web/.env.local` and run `git ls-files supabase/.temp`.
- **Impact:** Elevated risk of accidental secret leakage if `.env.local` is synced to Vercel or misprefixed; unnecessary infrastructure metadata in git.
- **Likelihood:** Low
- **Recommendation:** Remove `SUPABASE_SERVICE_ROLE_KEY` and duplicate `OPENAI_API_KEY` from `apps/web/.env.local`, add `supabase/.temp/` to `.gitignore`, and untrack `supabase/.temp/*`.

#### `SEC-10` — Client-Supplied Admin Audit Columns & Automation Script Bypassing Human Verification
- **Severity:** LOW | **Category:** Audit Integrity / Governance | **Confidence:** High
- **Affected Files:** `apps/web/app/dashboard/admin/AdminCorpusReview.tsx:121-132`, `scripts/validation/admin-review-flow.mjs:38-49`
- **Evidence:** `AdminCorpusReview.tsx` writes `verified_by`, `reviewed_by`, `verified_at`, and `reviewed_at` from client state instead of DB triggers/`auth.jwt()`. Separately, `scripts/validation/admin-review-flow.mjs` uses `SUPABASE_SERVICE_ROLE_KEY` to auto-verify pending corpus rows (`verified: true, status: 'current'`).
- **Reproduction:** Review `AdminCorpusReview.tsx:127-130` and `scripts/validation/admin-review-flow.mjs:38-50`.
- **Impact:** Admin audit trail can be forged by a compromised admin client; running the validation script on production would publish unreviewed legal text.
- **Likelihood:** Low
- **Recommendation:** Populate `reviewed_by`/`verified_by`/`*_at` via a Postgres `BEFORE UPDATE` trigger from `auth.jwt()`, and guard `admin-review-flow.mjs` so it refuses to run against non-test databases (or rolls back).

#### `DB-01` — Missing Essential B-Tree and GIN Full-Text Indexes Across Core Tables
- **Severity:** MEDIUM | **Category:** Database Performance | **Confidence:** High
- **Affected Files:** `database/schema.sql`, `database/user_documents_migration.sql`, `database/lexical_search_migration.sql`
- **Evidence:** No indexes exist on `document_chunks(version_id)`, `document_chunks(section_id)`, `legal_sections(version_id)`, `conversations(user_id, updated_at)`, `messages(conversation_id, created_at)`, `citations(message_id)`, `rate_limit_events(user_id, action, window_start)`, `user_documents(owner_id, created_at)`, or `user_document_questions(document_id, owner_id)`. Furthermore, `search_verified_document_chunks` computes `to_tsvector('english', ...)` dynamically on every row with no generated `tsvector` column or GIN index.
- **Impact:** Sequential table scans on every search, conversation load, document listing, and FK cascade delete as data grows.
- **Likelihood:** High
- **Recommendation:** Add the missing foreign-key/query B-Tree indexes and a persisted `tsv tsvector generated always as (...) stored` + GIN index on `document_chunks`/`legal_sections`.

#### `DB-02` — `ivfflat` Vector Indexes Created on Empty Tables Without Rebuild Step
- **Severity:** MEDIUM | **Category:** Database / Vector Search Quality | **Confidence:** High
- **Affected Files:** `database/schema.sql:106-108` (`lists = 100`), `database/user_documents_migration.sql:73-75` (`lists = 50`)
- **Evidence:** Both `ivfflat` indexes are created immediately after `CREATE TABLE` when row count is `0`, and `ingest-corpus.ts` never runs `REINDEX INDEX`.
- **Impact:** In `pgvector`, `ivfflat` built on an empty table creates uncalibrated centroids, severely hurting recall or causing vector searches to miss relevant legal provisions.
- **Likelihood:** High
- **Recommendation:** Migrate both vector indexes from `ivfflat` to `hnsw (embedding vector_cosine_ops)` (which maintains recall incrementally on inserts without needing post-load rebuilds).
