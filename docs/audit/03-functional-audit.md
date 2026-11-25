# LegalLens — Functional Audit

> **Status Legend:** `PASS` (verified via execution) | `FAIL` (verified broken in code/runtime) | `PARTIAL` (implemented with confirmed functional gaps) | `NOT IMPLEMENTED` (absent from codebase) | `NOT TESTED` (implemented in code, runtime not executed due to strict read-only mode) | `BLOCKED` (requires isolated staging Supabase + AI provider).

---

## 1. Feature Inventory

| Feature | Route / File | Backend Dependency | Frontend States (Load/Err/Empty) | Validation | Persistence | Authorization | Verdict | Evidence |
|---|---|---|---|---|---|---|---|---|
| **Landing Page** | `apps/web/app/page.tsx` | None (static + `LegalFactOfTheDay`) | N/A / N/A / N/A | N/A | N/A | Public | **PASS** | Verified in browser (`1280×800` & `375×812`) & `next start` load test (HTTP 200, 0 errors, 3D + SVG fallback working) |
| **Registration** | `apps/web/app/auth/register/page.tsx` | Supabase Auth `signUp` + Google OAuth | Yes / Yes / N/A | Client-only password rule (10+ chars mixed); HTML `required` | `auth.users` + `user_metadata` | Public | **NOT TESTED** *(PARTIAL static)* | Code sound except client-only password policy (no server-side policy in `config.toml`) and `window.location.href` hard reload (line 88) |
| **Login** | `apps/web/app/auth/login/page.tsx` | Supabase Auth `signInWithPassword` + Google OAuth (`/auth/callback`) | Yes / Yes / N/A | HTML `required` + `safeLocalRedirectPath` | Session cookies (`@supabase/ssr`) | Public | **PARTIAL** *(static)* | Functional login code, but `?error=oauth_callback_failed` from `auth/callback/route.ts:25` is **never displayed** on `login/page.tsx` (`FUN-04`) |
| **Logout & Global Revoke** | `DashboardShell.tsx:199-212`, `settings/page.tsx:77-94` | `supabase.auth.signOut({ scope: 'local' \| 'global' })` | Yes / Yes / N/A | Confirm dialog on global revoke | Cookie/token revocation | Authenticated | **NOT TESTED** *(implemented static)* | Code verified; live sign-out/token invalidation not run |
| **Password Recovery & Reset** | `forgot-password/page.tsx`, `reset-password/page.tsx` | `resetPasswordForEmail` + `updateUser({ password })` | Yes / Partial (`forgot` ignores errors) / N/A | Client-only 10-char rule on reset | `auth.users` | Recovery token | **FAIL** *(static)* | `forgot-password/page.tsx:19` sets `redirectTo: .../auth/reset-password`, bypassing `/auth/callback` PKCE code exchange; `reset-password/page.tsx` never exchanges `?code=` (`FUN-02`) |
| **Session Idle Timeout** | `DashboardShell.tsx`, `lib/session-idle.ts` | Client localStorage + `signOut({ scope: 'local' })` + `supabase/config.toml` `1h` | Redirects with `?reason=idle_timeout` | Finite timestamp check | `localStorage` per `session_id` | Authenticated | **NOT TESTED** *(implemented static)* | Implemented cleanly in `lib/session-idle.ts` & `DashboardShell.tsx` |
| **User Profile & Settings** | `apps/web/app/dashboard/settings/page.tsx` | `supabase.auth.getUser()`, `updateUser`, `ConsentSettings` | Partial (no loading state for initial fetch) / Yes / Fallback `—` | Password match + length | `auth.users`, `user_consent_events` | Authenticated | **PARTIAL** *(static)* | Profile fields (`name`, `state`, `city`, `phone`) are **read-only** after sign-up (line 131: "Editing them here isn't available yet") |
| **Dashboard Overview** | `apps/web/app/dashboard/DashboardOverview.tsx` | Server `layout.tsx` (`getUser()`) | Static render | N/A | N/A | Protected (`proxy.ts` + `layout.tsx`) | **PASS (build) / NOT TESTED (auth runtime)** | Static + build verified; responsive layout verified |
| **AI Legal Assistant (`/ask`)** | `apps/web/app/dashboard/ask/page.tsx` | `supabase/functions/ask` + OpenRouter + pgvector/FTS | Yes / Yes / Initial empty | Length 3..2000 (client + server) | `conversations`, `messages`, `citations` | Authenticated + RLS | **FAIL** *(static)* | (1) `citations.insert` **silently fails RLS** (`FUN-01`); (2) multi-turn context never loaded (`AI-01`); (3) no conversation history UI (`FUN-03`); (4) `source_url` from citations never rendered as clickable link in `ask/page.tsx:109-113` |
| **Conversation History / Saved Conversations** | None | `conversations` & `messages` tables exist | N/A | N/A | Written by `/ask` (minus citations) | RLS owner-scoped | **NOT IMPLEMENTED** | Zero UI or API exists to list, view, resume, or delete past conversations (`FUN-03`) |
| **Legal Research / Search** | `apps/web/app/dashboard/search/page.tsx` | `supabase/functions/legal?mode=search` | Yes (skeletons) / Yes / Yes | `q` 2..500, enum filters | Read-only corpus | Authenticated + RLS | **PARTIAL** *(static)* | No pagination; `legal/index.ts` downloads full corpus into memory and hits PostgREST 1,000-row cap (`ARC-01`); locally-ingested `local-corpus://` links are broken in browsers (`RAG-04`) |
| **Constitution Browser** | `apps/web/app/dashboard/constitution/page.tsx` | `supabase/functions/legal?mode=constitution` | Yes / Yes / Yes | Client filter string | Read-only corpus | Authenticated + RLS | **NOT TESTED** *(PARTIAL static)* | Depends on `legal/index.ts` full-corpus load; chapter-level granularity verified by 4 passing unit tests |
| **Rights Explorer** | `apps/web/app/dashboard/rights/page.tsx` | Hardcoded guides + `searchLegalSources` | Yes / Yes / Yes | N/A | Static + corpus search | Authenticated | **NOT TESTED** *(implemented static)* | Hardcoded Nigerian situation guides + corpus search + official agency links |
| **Case-Law Research** | `apps/web/app/dashboard/cases/page.tsx` | **External link builder only** (`nigerialii.org`) | N/A / N/A / N/A | Non-empty query | None | Authenticated | **PARTIAL** | Does not retrieve or store case law inside LegalLens; honestly discloses it links out to NigeriaLII |
| **Find a Lawyer & Waitlist** | `apps/web/app/dashboard/lawyers/page.tsx` | External NBA links + `lawyer_waitlist` table (`waitlist_migration.sql`) | N/A | Client form inputs | `lawyer_waitlist` (write-only RLS) | Authenticated | **NOT TESTED** *(implemented static)* | NBA directory/licence links + local referral text builder |
| **Document Intelligence (`/documents`)** | `apps/web/app/dashboard/documents/page.tsx` | `create-user-document-upload`, `process-user-document`, `ask-user-document`, Storage `user-documents` | Yes / Yes / Yes | Size `<=15MB`, MIME/ext/magic bytes, consent | `user_documents`, `user_document_chunks`, `user_document_questions`, `user_document_answer_sources` | Authenticated + owner RLS + consent | **PARTIAL** *(static)* | Pipeline logic unit-tested (8/8 pass), but: stuck-`'processing'` deadlock (`ARC-02`), unbatched embeddings (`AI-03`), no Q&A history UI despite saving to `user_document_questions`, and `SEC-01` path-traversal risk |
| **Correspondence Drafting** | `apps/web/app/dashboard/drafting/page.tsx` | `supabase/functions/draft-document` + OpenRouter | Yes / Yes / N/A | `draft_type` enum, `facts` 30..4000, consent | Intentionally non-persistent (`saved: false`) | Authenticated + consent | **NOT TESTED** *(implemented static)* | Strong prompt guardrails, copy/download actions, explicit non-storage disclosure |
| **Matters & Tasks** | `apps/web/app/dashboard/matters/page.tsx` | Direct PostgREST CRUD on `legal_matters`, `legal_matter_tasks` | Yes / Yes / Yes | Length checks + DB CHECK constraints | `legal_matters`, `legal_matter_tasks` | Authenticated + owner RLS | **NOT TESTED** *(implemented static)* | Full CRUD with owner-scoped RLS + composite FK integrity |
| **Admin Corpus Review** | `apps/web/app/dashboard/admin/AdminCorpusReview.tsx` | Direct PostgREST on `legal_source_versions`, `legal_sections` | Yes / Yes / Yes | Confirm dialog | Updates `verified`, `status`, `review_notes` | `app_metadata.role === 'admin'` (server + RLS) | **PARTIAL** *(static)* | `loadPending` queries `.eq('verified', false)` without excluding `status = 'rejected'`, so rejected versions reappear on every reload (`FUN-05`) |
| **Scenario Analysis** | None | None | N/A | N/A | N/A | N/A | **NOT IMPLEMENTED** | Mentioned only as target design in `docs/ai/AI_ARCHITECTURE.md`; no route or backend exists |
| **AI Agents** | None | None | N/A | N/A | N/A | N/A | **NOT IMPLEMENTED** | Confirmed in `docs/ai/AI_ARCHITECTURE.md:15` ("No orchestrator, tools, agents") |
| **Payments / Subscriptions** | None | None | N/A | N/A | N/A | N/A | **NOT IMPLEMENTED** | No billing tables, Stripe/Paystack integration, or routes exist |

---

## 2. End-to-End Workflow Assessment

| Workflow | Dynamic Execution Status | Static Code Verdict & Blockers |
|---|---|---|
| **A. Registration** | **BLOCKED** (no isolated staging Supabase auth instance) | Client validation present; server-side password complexity not enforced in `supabase/config.toml`; raw Supabase `error.message` displayed; `window.location.href` bypasses Next router. |
| **B. Authentication** | **BLOCKED** (live auth not run) | `proxy.ts` + `dashboard/layout.tsx` both verify via `getUser()`. **FAIL** on Password Recovery (`FUN-02`: PKCE `?code=` not exchanged). **PARTIAL** on OAuth failure feedback (`FUN-04`: `?error=oauth_callback_failed` ignored). |
| **C. AI Legal Assistant** | **BLOCKED** (live OpenRouter/Supabase not run; 8/8 unit logic tests **PASS**) | **FAIL** on citation persistence (`FUN-01`), multi-turn context (`AI-01`), and conversation history loading (`FUN-03`). **PARTIAL** on provider failure fallback (only handles HTTP 429, not 5xx/timeouts). |
| **D. Legal Research** | **BLOCKED** (live Supabase not run) | **PARTIAL**: No pagination; full-corpus load hits PostgREST 1,000-row cap (`ARC-01`); `local-corpus://` links broken (`RAG-04`). |
| **E. Document Intelligence** | **BLOCKED** (live Storage/Edge/OCR not run; 8/8 pipeline logic tests + 7/7 OCR gateway tests **PASS**) | **PARTIAL**: Strong magic-byte/UTF-8/pixel-bomb checks, but ZIP bomb header trust (`SEC-05`), unbatched embeddings (`AI-03`), stuck-`'processing'` deadlock (`ARC-02`), and no saved Q&A history viewer. |
| **F. Scenario Analysis** | **NOT IMPLEMENTED** | Does not exist in frontend or backend. |
| **G. Legal Rights** | **BLOCKED** (live search not run) | Implemented as static curated guides + corpus search + external agency links. |
| **H. AI Agents** | **NOT IMPLEMENTED** | All 3 AI endpoints are single direct LLM completions, not autonomous tool-using agents. |
| **I. Data Persistence** | **BLOCKED** (Docker daemon inaccessible in sandbox; remote DB untouched) | SQL schema has strong composite FKs & RLS for `legal_matters`/`user_documents`, but `citations` INSERT fails RLS (`FUN-01`) and `messages` allows user mutation (`SEC-04`). |

---

## 3. Functional Findings

#### `FUN-01` — AI Assistant Citations Silently Fail to Persist to Database (Missing INSERT RLS Policy)
- **Severity:** HIGH | **Category:** Functionality / Database | **Confidence:** High
- **Affected Files:** `supabase/functions/ask/index.ts:86-88, 408-415`, `database/schema.sql:218-226`
- **Evidence:** `database/schema.sql:218-226` defines only `for select to authenticated` on `public.citations` (no `INSERT` policy). `ask/index.ts:409` inserts into `citations` using the caller's anon/JWT client without inspecting the returned `{ error }`.
- **Reproduction:** Submit any question to `/functions/v1/ask` that produces >=1 valid citation, then query `select count(*) from public.citations;` as `service_role`. Count remains `0`.
- **Impact:** Zero audit trail of which legal sources backed persisted AI answers; any future conversation history view will display uncited answers.
- **Likelihood:** High (100% of `/ask` requests with citations)
- **Recommendation:** Persist assistant messages and citations via a dedicated `service_role` client (after verifying conversation ownership) or a `SECURITY DEFINER` RPC, and check/log every insert error.

#### `FUN-02` — Password Reset Flow Broken Under Supabase SSR PKCE (`?code=` Never Exchanged)
- **Severity:** HIGH | **Category:** Functionality / Authentication | **Confidence:** High
- **Affected Files:** `apps/web/app/auth/forgot-password/page.tsx:18-20`, `apps/web/app/auth/reset-password/page.tsx:37-42`
- **Evidence:** `forgot-password/page.tsx:19` passes `redirectTo: \`${window.location.origin}/auth/reset-password\``. `@supabase/ssr` uses PKCE by default, appending `?code=...` to the redirect URL. Neither `proxy.ts` nor `reset-password/page.tsx` calls `exchangeCodeForSession(code)` before calling `supabase.auth.updateUser({ password })`.
- **Reproduction:** Request a password reset in Supabase PKCE mode, click the emailed link (`/auth/reset-password?code=...`), submit a new password -> Supabase returns `Auth session missing`.
- **Impact:** Users cannot recover locked accounts via email password reset.
- **Likelihood:** High
- **Recommendation:** Set `redirectTo` to `${window.location.origin}/auth/callback?next=/auth/reset-password` so `auth/callback/route.ts` exchanges the PKCE code and sets the session cookie before redirecting to `/auth/reset-password`.

#### `FUN-03` — Conversation History & Document Q&A History Persisted in DB but Inaccessible in UI
- **Severity:** MEDIUM | **Category:** Functionality | **Confidence:** High
- **Affected Files:** `apps/web/app/dashboard/ask/page.tsx`, `apps/web/app/dashboard/documents/page.tsx`
- **Evidence:** `ask/index.ts` writes `conversations` and `messages`, and `ask-user-document/index.ts` writes `user_document_questions` and `user_document_answer_sources`, yet neither page queries or displays prior questions/conversations (and refreshing `/dashboard/ask` loses the entire exchange). Furthermore, `ask/page.tsx:109-113` displays `citation.source_title · citation.section_label` as plain text and ignores `citation.source_url` returned by the API.
- **Reproduction:** Ask a question on `/dashboard/ask` or `/dashboard/documents`, refresh the browser -> previous Q&A disappears with no way to retrieve it.
- **Impact:** Poor usability; users cannot review prior research or click through to cited source URLs.
- **Likelihood:** High
- **Recommendation:** Add conversation/document Q&A history retrieval and render valid `https://` `source_url` links on citations.

#### `FUN-04` — OAuth Callback Errors Silently Dropped on Login Page
- **Severity:** MEDIUM | **Category:** Functionality / UX | **Confidence:** High
- **Affected Files:** `apps/web/app/auth/callback/route.ts:25`, `apps/web/app/auth/login/page.tsx:18-24`
- **Evidence:** `callback/route.ts:25` redirects failures to `/auth/login?error=oauth_callback_failed`, but `login/page.tsx:18-24` only reads `reason=idle_timeout` and `reason=session_expired`, completely ignoring `error=oauth_callback_failed`.
- **Reproduction:** Navigate to `/auth/login?error=oauth_callback_failed` -> no error banner appears.
- **Impact:** Failed Google OAuth logins return users to a blank login form with no explanation.
- **Likelihood:** Medium
- **Recommendation:** Handle `error=oauth_callback_failed` in `login/page.tsx` with a clear `role="alert"` message.

#### `FUN-05` — Rejected Corpus Versions Reappear as "Unverified" in Admin Review Queue
- **Severity:** LOW | **Category:** Functionality / Admin | **Confidence:** High
- **Affected File:** `apps/web/app/dashboard/admin/AdminCorpusReview.tsx:49-53, 121-132`
- **Evidence:** Rejecting a version sets `verified: false, status: 'rejected'`, and `loadPending()` filters only `.eq('verified', false)` without `.neq('status', 'rejected')`.
- **Reproduction:** Reject a pending version in `/dashboard/admin`, refresh the page -> the rejected version reappears tagged `"Unverified"`.
- **Impact:** Admin queue becomes cluttered with already-rejected corpus uploads; risk of accidental re-review/approval.
- **Likelihood:** High
- **Recommendation:** Filter `.eq('verified', false).neq('status', 'rejected')` for the active queue and add a separate tab/filter for rejected items.
