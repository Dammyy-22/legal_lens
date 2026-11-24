# Engineering changelog (remediation work)

## Batch 1 — Quality gates and urgent security (2026-11-23, branch `fix/batch-1-gates-and-zdr`)

**Scope:** LL-001, LL-002, LL-004, LL-005 (part), LL-053. No database migrations. No product behaviour change except that provider calls now fail closed if no zero-data-retention endpoint exists for the model.

**Files changed**
- `apps/web/package.json`, `package-lock.json` — `next ^16.4.6`, `eslint ^9.39.5`, `eslint-config-next ^16.4.6`, `lint` script = `eslint .`; lockfile also picked up non-breaking advisory fixes
- `apps/web/eslint.config.mjs` — new flat config (two React rules set to warn, see LL-050)
- `supabase/functions/_shared/openrouter-policy.mjs` (+ `.test.mjs`) — new; single place that builds provider request bodies with the ZDR/no-collection policy
- `supabase/functions/_shared/openrouter.ts` — uses the policy builders; logs a clear message on HTTP 404 (no ZDR endpoint)
- `supabase/functions/draft-document/index.ts` — `jsonResponse` accepts extra headers (fixes dropped `Retry-After`)
- `supabase/functions/process-user-document/index.ts` — `bytes.slice()` for `crypto.subtle.digest` typing
- `database/ci/supabase_stub.sql` — CI stub extracted from the workflow (CI use only; never apply to Supabase)
- `.github/workflows/ci.yml`, `.github/dependabot.yml` — expanded checks, weekly dependency PRs

**Commands run and results (sandbox, 2026-11-23)**
| Command | Result |
|---|---|
| `npm ci` (clean) in `apps/web` | OK |
| `npm audit` / `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `npm run lint` | exit 0, 0 errors, 7 warnings |
| `npx tsc --noEmit` | exit 0 |
| `next build` (dummy public env) | exit 0, Next.js 16.4.6, 20 pages |
| `deno check index.ts` × 6 functions (Deno 2.9.6) | all exit 0 |
| `node --test` ask (8), provider policy (6), process-user-document (5), ask-user-document (3), ingestion (4) | all pass |
| Python OCR gateway `unittest` | 7/7 pass |
| Migration sequence from CI on fresh PostgreSQL 16 + pgvector 0.6.0 | applies cleanly; rerunnable migrations re-run cleanly |

**Not verified:** the new GitHub Actions workflow itself (no Actions runner here); the `gitleaks-action` step; a Vercel build; any live OpenRouter call. CI's pgvector image version may differ from the sandbox's.

**Required before deploy (owner actions)**
1. Confirm ZDR eligibility of the configured models on OpenRouter, e.g. `curl -s "https://openrouter.ai/api/v1/models?zdr=true"` and check `openai/gpt-4.1-mini` is listed, and that embeddings work with `provider.zdr` (docs list a `provider` field on the embeddings request, but I could not call it). If a model is not eligible, set `OPENROUTER_MODEL` / the embedding model env var to an eligible one first; otherwise `ask` will return errors.
2. Set a spend limit on the OpenRouter key.
3. Merge to a preview branch first and check the Vercel preview build and one `ask` and one document question.

**Rollback:** revert the merge commit. No data or schema changes are involved.

## Batch 2 — Server-enforced consent for AI processing (2026-11-23, branch `fix/batch-2-document-consent`, built on Batch 1)

**Scope:** LL-020 (corrected), LL-054, LL-055. One additive migration with a tested rollback.

**Correction to my Stage 1 audit:** I reported that no consent step existed. That was wrong — a browser checkbox exists on the Documents and Drafting pages (my text search skipped `.tsx` files). The real gap was that it was client-side only. The registry, security audit and repository audit are corrected.

**Files changed**
- `database/user_consent_migration.sql` (new) — append-only `user_consent_events` (ordered by an identity `seq`; a first draft ordered by timestamp and the new test caught ties within a transaction), RLS read-own, RPCs `grant_consent` / `withdraw_consent` / `has_current_consent`
- `database/rollbacks/user_consent_rollback.sql` (new; destroys the consent log — export first)
- `database/tests/user_consent_test.sql` (new) — two-user authorization tests (first RLS tests in the repo)
- `supabase/functions/_shared/consent.mjs` (+ `consent.test.mjs`) — gate used by four functions; fail-closed
- `supabase/functions/{create-user-document-upload,process-user-document,ask-user-document,draft-document}/index.ts` — gate right after authentication
- `apps/web/lib/consent.ts`, `components/ConsentSettings.tsx` — record, check, withdraw; Settings page section
- `apps/web/app/dashboard/{documents,drafting,ask,settings}/page.tsx` — record consent before processing, pre-tick if already recorded, updated wording, `ask` disclosure
- `.github/workflows/ci.yml` — consent migration, re-run, SQL tests, rollback + re-apply, consent unit tests
- `docs/operations/staging-setup.md` (new); audit docs corrected

**Commands run and results (sandbox)**
| Command | Result |
|---|---|
| Full CI SQL sequence on a clean PostgreSQL 16 + pgvector (stub, schema, all migrations, re-runs, consent migration ×2, tests, rollback, re-apply) | all succeed |
| `database/tests/user_consent_test.sql` | all assertions pass |
| `node --test` consent (5), openrouter-policy (6) | pass |
| `deno check` on all 5 touched functions | exit 0 |
| `tsc --noEmit`, `npm run lint`, `next build` | exit 0; lint 0 errors / 7 known warnings |

**Not verified:** behaviour against a real Supabase project (RLS/grants differ slightly from my local stub), the GitHub Actions run, real browser flows (consent prompts, Settings withdrawal) — **no UI was exercised in a browser**.

**Deploy order (important)**
1. Apply `user_consent_migration.sql` to **staging**, test (see `docs/operations/staging-setup.md`), then production.
2. Deploy the four Edge Functions.
3. Deploy the web app.
If functions go out before the migration, uploads, document questions and drafting fail closed with 503 until the migration is applied. Existing users must tick the consent box once to continue using earlier documents.

**Rollback:** redeploy previous functions and web, then run `database/rollbacks/user_consent_rollback.sql` (only after the functions no longer call it).
