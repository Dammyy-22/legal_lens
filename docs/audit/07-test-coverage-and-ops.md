# LegalLens — Test Coverage, Dependencies & Operations Report

## 1. Test Inventory & Executed Verification Results

| Test Suite / Check | Scope | Execution Result | Quality Assessment |
|---|---|---|---|
| `supabase/functions/ask/logic.test.mjs` | `normalizeQuestion`, `extractCitationIds`, `selectValidCitationIds`, `buildSourceExtract`, `computeRateLimitState` | **PASS** (included in 31/31 Node tests) | Useful unit coverage of pure logic; does not test DB persistence (`FUN-01`) or HTTP handler |
| `supabase/functions/_shared/openrouter-policy.test.mjs` | Strict ZDR policy (`zdr: true`, `data_collection: 'deny'`), immutability, 404 diagnostic | **PASS** (included in 31/31 Node tests) | High value |
| `supabase/functions/_shared/consent.test.mjs` | `checkConsent`, policy version parity between web & Edge, all AI Edge functions call `checkConsent` | **PASS** (included in 31/31 Node tests) | High value |
| `supabase/functions/process-user-document/logic.test.mjs` | Chunking, UTF-8/null rejection, DOCX XML extraction, ZIP header checks | **PASS** (included in 31/31 Node tests) | Useful, though doesn't test forged-header ZIP bomb (`SEC-05`) |
| `supabase/functions/ask-user-document/logic.test.mjs` | Citation filtering, fallback refusal on 0 valid citations, labels | **PASS** (included in 31/31 Node tests) | High value |
| `scripts/ingestion/constitution-structure.test.mjs` | Constitution chapter parsing vs TOC | **PASS** (included in 31/31 Node tests, `640.8 ms` total) | High value |
| `services/unlimited-ocr-gateway/test_gateway.py` | Page number parsing, bearer auth, output cleaning, pixel limits, mocked vLLM | **PASS (7/7 in `0.592 s` via `.venv`)** *(system Python failed: missing `pymupdf`)* | Good unit coverage; misses live HTTP slowloris/concurrency tests |
| `database/tests/user_consent_test.sql` | 2-user + anon authorization tests for `user_consent_events` | **BLOCKED locally** (Docker config access denied; runs in CI) | High value — should be mirrored for all other tables |
| `scripts/validation/supabase-e2e-smoke.mjs` & `admin-review-flow.mjs` | Manual live smoke scripts | **NOT TESTED** | `admin-review-flow.mjs` mutates DB rows with `service_role` (`SEC-10`) |
| TypeScript & Build (`tsc --noEmit`, `npm run lint`, `npm run build`) | Static types, ESLint, Next.js 22-route build | **PASS** (`tsc`: 0 errors; `eslint`: 0 errors / 8 warnings; `build`: 0 errors) | Verifies compilation only, not runtime correctness |

---

## 2. Critical Test Coverage Gaps (`TST-01`)

#### `TST-01` — Zero Frontend, E2E, Edge-Function Integration, Cross-User RLS (Beyond Consent), or AI Eval Tests
- **Severity:** HIGH | **Category:** Test Coverage / QA | **Confidence:** High
- **Affected Scope:** Entire repository (`apps/web`, `supabase/functions`, `database/`)
- **Evidence:**
  1. Zero frontend component or unit tests (no Vitest/Jest/RTL).
  2. Zero browser E2E tests (no Playwright/Cypress) — directly allowed `FUN-02` (broken PKCE password reset) and `FUN-04` (dropped OAuth errors) to slip through.
  3. Zero Edge Function HTTP integration tests against local/CI Supabase — directly allowed `FUN-01` (100% silent failure on `citations` insert) to go undetected.
  4. Zero cross-user RLS authorization tests for `user_documents`, `user_document_chunks`, `user_document_questions`, `conversations`, `messages`, `citations`, `legal_matters`, `legal_matter_tasks`, or `storage.objects` (only `user_consent_events` has SQL RLS tests).
  5. Zero automated AI accuracy, hallucination, or prompt-injection evaluation tests.
- **Recommendation:** Add (a) SQL RLS cross-user tests for every table in CI, (b) Edge Function integration tests with mocked OpenRouter + local Postgres, (c) Playwright E2E smoke tests for auth/reset/ask/documents, and (d) an automated golden-set AI evaluation script.

---

## 3. Dependency & Supply-Chain Audit (`DEP-01`)

- **`apps/web` (`npm audit --json`):** `0` vulnerabilities (`info:0, low:0, moderate:0, high:0, critical:0`).
  - Notable outdated packages (`npm outdated`): `@supabase/supabase-js` (`2.112.4` → `2.119.2`), `@supabase/ssr` (`0.12.5` → `0.12.7`), `lucide-react` (`1.35.0` → `1.80.0`), `react`/`react-dom` (`19.2.4` → `19.3.1`, intentionally `<19.4` for `@react-three/fiber@9.8.2`), `tailwindcss` (`3.4.19` → `4.3.5` major), `eslint` (`9.39.5` → `10.15.0` major), `typescript` (`5.9.3` → `7.0.2`).
- **`scripts/ingestion` (`npm audit --json`):** `0` vulnerabilities, though `pdf-parse@^1.1.1` is legacy/unmaintained and `openai` (`^4.63.0`) / `@supabase/supabase-js` (`^2.45.4`) trail newer releases.
- **`services/unlimited-ocr-gateway/requirements.txt`:** `PyMuPDF>=1.28,<2` without a pinned lockfile/hash (`pip freeze` / `uv.lock`).
- **CI Audit Config:** `.github/workflows/ci.yml:24` runs `npm audit --omit=dev --audit-level=high` (misses `moderate` vulnerabilities). `.github/dependabot.yml` is configured.
- **Severity:** **INFO** (`DEP-01` — clean today, tighten audit threshold to `moderate` and pin Python OCR deps).

---

## 4. Deployment, CI/CD & Operations Findings

#### `OPS-01` — Zero Application Monitoring, Error Tracking, Alerting, or Telemetry
- **Severity:** HIGH | **Category:** Operations / Observability | **Confidence:** High
- **Affected Scope:** `apps/web`, `supabase/functions/*`, `services/unlimited-ocr-gateway`
- **Evidence:** Only `console.log`/`console.warn`/`console.error` exist; no Sentry, OpenTelemetry, Datadog, structured JSON logging, health dashboards, or alert hooks exist anywhere in the codebase.
- **Impact:** Silent production failures (such as `FUN-01` citation insert failure or OpenRouter 5xx spikes) and cost anomalies are invisible to operators.
- **Likelihood:** High
- **Recommendation:** Integrate error tracking (e.g., Sentry) in `apps/web` and structured JSON logging + token/latency/error telemetry across all 6 Edge Functions and the OCR gateway.

#### `OPS-02` — Missing Deployment Configuration, IaC, Environment Separation, and Branch CI Coverage
- **Severity:** MEDIUM | **Category:** DevOps / Deployment | **Confidence:** High
- **Affected Files:** Repo root (`vercel.json` absent, `infrastructure/` empty), `.github/workflows/ci.yml:3-6`
- **Evidence:** No `vercel.json`, no Supabase Edge Function deploy workflow, `infrastructure/` has 0 files, and no environment matrix distinguishes development/preview/production secrets or URLs. Additionally, `.github/workflows/ci.yml` only triggers on `push: branches: [main]` and `pull_request` — direct pushes to `release/batches-1-2` (current active branch) do not run CI unless a PR is opened.
- **Recommendation:** Add explicit CI/CD deployment workflows with separate staging and production Supabase projects, document rollback procedures, and trigger CI on `release/*` branches.

#### `OPS-03` — Non-Idempotent Base Schema & No Ordered `supabase/migrations/` Pipeline
- **Severity:** LOW | **Category:** Database Operations | **Confidence:** High
- **Affected Files:** `database/schema.sql:4`, `supabase/`
- **Evidence:** `database/schema.sql` uses non-idempotent `CREATE POLICY` statements and migrations live as ad-hoc files in `database/` rather than timestamped `supabase/migrations/` managed by `supabase db push`.
- **Recommendation:** Consolidate schema + migrations into timestamped `supabase/migrations/` files for repeatable automated deployments.

#### `OPS-04` — Strong Operational Documentation & Secret-Scanning CI Controls Present
- **Severity:** INFO | **Category:** Operations | **Confidence:** High
- **Evidence:** `.github/workflows/ci.yml` runs `gitleaks/gitleaks-action@v2` over full history (`fetch-depth: 0`), verifies Deno type-checks (`deno check`), runs `pgvector:pg16` schema migration + idempotency + rollback tests, and `docs/operations/` documents admin review and AI reliability procedures.
