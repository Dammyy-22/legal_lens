# LegalLens — Remediation Roadmap

**Updated:** 2026-11-25

---

## Completed in Code & Tests (Ready for Staging Deployment)

| Phase | Issue ID(s) | Status | What Was Delivered |
|---|---|---|---|
| **Phase 0** | `PROV-SEC-01`, `SEC-09` | **Code Done / Key Rotation Pending** | Restored `apps/web/.env.example`, removed `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. |
| **P0 Blockers** | `SEC-01`, `SEC-02`, `RAG-01`, `SEC-03`, `SEC-04`, `FUN-01`, `FUN-02`, `RAG-02` | **Fixed in Code & SQL** | Exact storage path CHECK + `service_role` upload registration; bounded `match_document_chunks` with `status='current'`; Postgres atomic rate limits; read-only `messages` for users + `service_role` writes in `/ask`; PKCE reset via `/auth/callback`; fail-closed `finalizeGroundedAnswer`. |
| **P1 High** | `ARC-01`, `AI-01`, `TST-01` | **Fixed (Unit/CI)** | Paginated SQL search RPCs (`legal/index.ts`); multi-turn history + query rewrite + thread UI (`/ask`); `54/54` Node tests, `7/7` Python OCR tests, `security_hardening_test.sql`, 50-case Nigerian eval dataset, CI integration. |
| **P2 Reliability & AI** | `DB-01`, `DB-02`, `SEC-06`, `SEC-07`, `SEC-08`, `AI-02`, `AI-03`, `AI-04`, `RAG-03`, `RAG-04`, `FUN-03`, `FUN-04`, `OPS-02` *(CI)* | **Fixed** | 10 indexes + HNSW vector migration; CSP & CORS allowlist; `'legal_qa'` consent gating; scoped `legal_sources` + escaped LIKE; multi-provider `ModelProvider` (`OpenRouter` + `Groq`), non-Azure ZDR fallback (`claude-haiku-5.5`), token usage telemetry & daily caps, prompt-guard pre-filter & prompt-leakage/statutory checks; 400-char overlap + batched ingestion + `FCCPA-2018.pdf` alias + state jurisdiction tags. |
| **P3 Cleanup / Perf** | `SEC-10`, `FUN-05`, `PERF-01`, `DEP-01` | **Fixed** | Server-derived `verified_by`/`verified_at` DB trigger; rejected versions hidden in Admin queue; uncookied public route skip in `proxy.ts` + React `cache()` `getServerUser`; CI `npm audit` lowered to `moderate`. |

---

## Remaining Actions Required Before Public Production Launch

| Priority | Action | Owner / Prerequisite |
|---|---|---|
| **P0 (External)** | Rotate `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, and Supabase `service_role` keys; configure OpenRouter key credit cap (`limit`) + fund paid tier; verify Groq Console ZDR opt-in before setting `GROQ_ZDR_CONFIRMED=true`. | Project Owner / Ops |
| **P0 (Database)** | Run [audit_hardening_migration.sql](file:///c:/Users/hp/Documents/legal_lens/database/audit_hardening_migration.sql) followed by [ai_provider_hardening_migration.sql](file:///c:/Users/hp/Documents/legal_lens/database/ai_provider_hardening_migration.sql) in staging & production Supabase. | DevOps / DB Admin |
| **P0 (Edge Deploy)** | Set Supabase Edge secrets (`OPENROUTER_API_KEY`, `GROQ_API_KEY`, `ALLOWED_CORS_ORIGINS`, optional `OPENROUTER_FALLBACK_MODEL`) and deploy all 6 Edge Functions + re-ingest `FCCPA-2018.pdf` with overlap & `embedding_model`. | DevOps |
| **P1 (Eval & E2E)** | Execute [NIGERIAN_LEGAL_EVAL_DATASET.json](file:///c:/Users/hp/Documents/legal_lens/docs/ai/NIGERIAN_LEGAL_EVAL_DATASET.json) (50 cases) against staging with legal expert review + run `validation/supabase-e2e-smoke.mjs` & Playwright E2E suite. | QA / Legal Reviewer |
| **P1 (Ops & Sec)** | Enable minimum 10–12 char password policy + breached-password checks in Supabase Auth dashboard; integrate Sentry/APM + alerting (`OPS-01`); front OCR gateway with Uvicorn/Gunicorn (`SEC-05`). | DevOps / Security |
| **P2 (Architecture / Corpus)** | Ingest priority missing Nigerian statutes (NDPA 2023, ACJA 2015, CAMA 2020, Lagos Tenancy Law, Evidence Act 2011) via Admin verification flow (`RAG-03`); move document OCR to async worker (`ARC-02`). | Legal Ops / Backend |
