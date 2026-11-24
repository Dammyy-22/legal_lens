# LegalLens — Issue Register (Stage 1)

Date: 2026-11-23. **Type** is one of: `Confirmed` (seen in code/tooling output), `Potential` (plausible, needs verification), `Gap` (feature absent vs. the master prompt), `Unknown` (cannot be determined from the repo).
**Priority:** P0 critical (auth/access/data integrity/secret exposure), P1 core workflow/document security/RAG reliability/provider, P2 agents/observability/performance/maintainability, P3 optional.
**No P0 was found.** Status of every item: `Open` — nothing has been fixed yet.

## Confirmed defects

| ID | P | Title | Evidence | Proposed fix (Stage 2) |
|---|---|---|---|---|
| LL-001 | P1 | Next.js 16.3.4 is inside the advisory range (`16.0.0 – 16.4.4`); `sharp` and `source-map-js` also flagged | `npm audit --omit=dev`: 1 critical, 2 high, fixes available. Installed version from `node_modules/next/package.json`. App uses `next/image`. Reachability of each advisory depends on hosting (Vercel-managed vs self-hosted) — *unverified* | Upgrade `next` (and `eslint-config-next`) to a patched release; re-run build; add Dependabot/`npm audit` CI gate |
| LL-002 | P1 (remediate first; owner confirmed no account-level ZDR) | No data-policy controls on OpenRouter requests | `_shared/openrouter.ts` sends only `model/messages/max_tokens/temperature`; no `provider.zdr` / `provider.data_collection`. OpenRouter docs: `data_collection` defaults to `allow` (providers may store/train) | Add request-level `provider: { zdr: true, data_collection: "deny" }` for all calls (immediate); full provider policy in `PROVIDER_MATRIX.md`. Check account-level privacy toggles (Unknown) |
| LL-003 | P1 | Rate limiting missing on 4 of 6 functions; the 2 that have it are per-isolate memory only | Rate-limit code exists only in `ask` and `draft-document`, both `Map`-based. `ask`'s `supabase` backend only inserts audit rows (no enforcement). `ask-user-document` and `process-user-document` each trigger paid embedding/chat calls with no limit | Shared DB-backed (atomic) limiter used by all AI-calling functions; per-user daily token/cost budget |
| LL-004 | P2 | `npm run lint` is broken | `next lint` exits 1 ("Invalid project directory …/apps/web/lint") on Next 16; `eslint-config-next@^14` vs `next@^16` mismatch; CI has no lint step | Migrate to ESLint CLI flat config; add lint to CI |
| LL-005 | P1 | CI does not cover most safety-relevant code | `ci.yml` omits: `ask/logic.test.mjs`, `draft-document` type-check, waitlist/matter/lexical migrations, `services/unlimited-ocr-gateway/test_gateway.py`, any RLS/authorization test, any lint/secret scan | Extend CI (batch 1) before further feature work |
| LL-006 | P2 | Conversation persistence errors are swallowed and non-atomic | `persistExchange` ignores the user-message insert result, logs-and-returns on assistant insert error, ignores citation insert errors; client-supplied `conversation_id` is used unchecked (RLS rejects foreign IDs, so the answer is returned but silently unsaved) | Validate ownership up front; single RPC/transaction; surface persistence failure |
| LL-007 | P2 | Citation validation proves the cited ID was retrieved, not that the claim is supported | `selectValidCitationIds` only intersects IDs; text without citations is still returned (flagged `uncertain` only when zero valid citations) | Deterministic quote/span verification + claim-level citations — see `RAG_AND_CITATIONS.md` |
| LL-008 | P2 | No evaluation or regression set for retrieval/citation/groundedness | `docs/operations/ai-assistant-reliability.md` lists an evaluation *plan*; no dataset or runner in repo | Build lawyer-verified question set + CI mocked evals |
| LL-009 | P2 | Single provider, single model, no fallback chain | Only OpenRouter; non-429 provider errors return 502; fixed 45 s timeout; model overridable by env with no allow-list | Provider abstraction with typed fallback and health/timeout policy |
| LL-010 | P3 | Repo hygiene and stale docs | No root `CLAUDE.md` (only `apps/web/CLAUDE.md`, a Next.js agent block); `DECISIONS.md` mostly documents the retired FastAPI/Alembic stack; README references `AI_SAFETY.md` (absent); `supabase/.temp/*` committed (project ref, org id, pooler host); two `.patch` files in root; stray file `scripts/ingestioncUsershpDocumentslegal_lens.venvScriptsactivate.bat`; ingestion README contains the real Supabase project URL | Add root `CLAUDE.md`; archive/rewrite `DECISIONS.md`; remove `.temp` and stray files; add `AI_SAFETY.md` |
| LL-011 | P2 | Committed corpus artefacts: licensing, size and version ambiguity | Raw texts, OCR page PNGs and four chunk generations for the Police Act (`chunks`, `chunks-v2`, `chunks-v4`, plus audit files) are in git despite `.gitignore` excluding `/legal corpus/`. Source rights *unverified* | Decide per-source redistribution rights; move heavy artefacts out of git; record the live chunk version |
| LL-012 | P3 | CORS `Access-Control-Allow-Origin: *` on all functions | Present in every `index.ts`. Auth is bearer-token so risk is low | Restrict to the app origin(s) |

## Potential risks (need verification)

| ID | P | Title | Why it matters / how to verify |
|---|---|---|---|
| LL-020 | P1 | No consent/disclosure before private documents go to a third-party model | A text search of `apps/web/app/dashboard/documents` found no consent wording; page not read in full. Master prompt forbids sending confidential documents to providers before privacy terms and consent are addressed. Verify UI + `deployment-checklist.md` |
| LL-021 | P2 | Admin verification is a direct client-side `UPDATE` with a client-supplied `verified_by` | `AdminCorpusReview.tsx` writes `verified_by` from the browser; RLS policy lets an admin update any column of `legal_source_versions`; no immutable audit log or content-hash pinning at verification time; admin MFA depends on dashboard settings |
| LL-022 | P2 | ivfflat indexes created at schema time (`lists=100` / `50`) | ivfflat quality depends on building after data load; likely poor recall until reindexed. Verify with a recall test on loaded data; consider HNSW |
| LL-023 | P2 | English-only regex safety triage with high-recall phrases | `under arrest` / `being detained` route to a fixed message instead of rights information; Pidgin/Yoruba/Igbo/Hausa phrasing unhandled. Product decision needed |
| LL-024 | P2 | Embedding drift between ingestion (OpenAI direct) and runtime (OpenRouter) | Same model name today, but env overrides on either side would silently mix vector spaces; dimension is checked (1536) but model identity is not stored |
| LL-025 | P3 | Lexical fallback returns `ts_rank_cd` in the `similarity` field | Different scale/meaning from cosine similarity; UI/logic that treats it uniformly could mislead |
| LL-026 | P3 | Document stuck in `processing` after a hard runtime kill | Normal failures reset to `failed` (verified in the `catch`); a platform timeout/kill would not, and the claim query only accepts `uploaded|failed`. Add a stale-claim reaper |
| LL-027 | P2 | `ask` high-risk and no-evidence replies are written to `messages` as assistant content with no version stamp of the policy text | Minor traceability gap for safety messages |

## Gaps versus the master prompt (features)

| ID | P | Gap |
|---|---|---|
| LL-030 | P2 | No central orchestrator; three separate pipelines (`ask`, `ask-user-document`, `draft-document`) |
| LL-031 | P2 | No typed tool contracts or structured-output validation (answers are free text with `[[cite:…]]` tags) |
| LL-032 | P2 | No scenario-analysis, rights-information or evidence-verification agent capability |
| LL-033 | P2 | No request tracing/observability (no trace IDs, token/cost/latency logging) |
| LL-034 | P2 | No reranking or hybrid retrieval fusion (vector then FTS fallback only) |
| LL-035 | P3 | No mocked-provider test harness; no live-provider smoke tests |

## Unknowns

| ID | Item |
|---|---|
| LL-040 | Hosted Supabase Auth settings (MFA, inactivity, refresh-token reuse detection, email confirmation, password policy) |
| LL-041 | OpenRouter privacy toggles: owner says NOT enabled (confirms LL-002). Spend limit/key scoping still unknown; owner has set no budget |
| LL-042 | Which corpus rows are `verified`/`current` in production |
| LL-043 | RESOLVED by owner: Vercel-managed Next.js + Supabase |
| LL-044 | Contents of `legal` and `create-user-document-upload` beyond header/auth checks; user-facing pages beyond those cited |
| LL-045 | Migration reversibility: all `database/*.sql` files are forward-only; user-documents migration is re-runnable (CI proves), others untested for re-run |
