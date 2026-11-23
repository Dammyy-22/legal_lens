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
