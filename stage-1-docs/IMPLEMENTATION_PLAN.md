# LegalLens — Implementation Plan (proposed, awaiting approval)

**Nothing below has been started.** Per the master prompt, Stage 2 begins only after you approve this plan (or an edited version of it). Each batch: state scope and files, smallest safe change, tests, typecheck/lint/build, diff review, update `ISSUE_REGISTER.md` and a changelog. No batch proceeds past a blocker that risks data loss or a security regression. No deployment without your explicit approval.

## Decisions recorded (from owner, 2026-11-23)

| # | Question | Answer | Effect on plan |
|---|---|---|---|
| 1 | Next.js hosting | Vercel (managed) + Supabase | Self-hosted-only Next advisories are less likely reachable; upgrade is still Batch 1 (LL-001). Confirm with a Vercel build log after upgrade |
| 2 | OpenRouter zero-retention settings | **Not enabled** | LL-002 stands as written: private-document text may currently route to providers that store/train. Fix is Batch 1 |
| 3 | Private documents | **Keep enabled** | With no consent step (LL-020) and no ZDR (LL-002), this is the highest-risk live exposure. Recommendation: treat LL-002 and LL-020 as **P0 for remediation order**, and ship the consent step immediately after Batch 1 (moved ahead of Batch 2). Owner may still choose to pause processing for the gap |
| 4 | Budget | None set | Free providers whose terms allow training cannot be used for user content. A small spend cap on the OpenRouter key is needed; compliant models cost money. Owner to set a cap; plan designs around "lowest-cost ZDR-eligible model" |
| 5 | Corpus redistribution | All sources may be redistributed (owner statement; not verified by me, not legal advice) | LL-011 reduced to size/version clean-up only |
| 6 | Arrest/detention triage | **Yes** — give rights information alongside emergency guidance | LL-023 becomes a Batch 8 item with a drafted, lawyer-reviewed message |
| 7 | Eval authorship | Lawyers will be onboarded; answers must match the corpus but read in natural human language | Eval set blocked on lawyer onboarding; composition style guide added in `RAG_AND_CITATIONS.md` §4.6 |
| 8 | Staging | Uses Supabase; no staging project known | Create a second Supabase project (or run the Supabase CLI local stack) for migrations; I will not run any migration against production. Check current Supabase plan limits for a second project |

Open: monthly spend cap (number), and the lawyer onboarding date.

## Batches

### Batch 0 — Repo hygiene and ground rules (P3, low risk)
Add root `CLAUDE.md` (build/test commands, security rules, "never read `.env*`", stage gates); remove `supabase/.temp`, stray `.bat`, root `.patch` files (or archive); mark `DECISIONS.md` legacy and add current `DECISIONS` entries; add `AI_SAFETY.md`. Tests: none needed. Reversible by git.

### Batch 1 — Quality gates and urgent security (P1)
- Upgrade `next`, `eslint-config-next`, flagged transitive deps; fix `lint` script for Next 16 (LL-001, LL-004).
- Extend CI: `ask` tests, `draft-document` check, all migrations, OCR gateway tests, lint, `npm audit --omit=dev --audit-level=high`, secret scan, Dependabot config (LL-005).
- Add ZDR + `data_collection: "deny"` to `_shared/openrouter.ts` with unit test asserting the request body (LL-002).
Files: `apps/web/package.json(+lock)`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `supabase/functions/_shared/openrouter.ts` (+test).
Risk: Next upgrade may need code changes; verified by build/typecheck/tests.

### Batch 2 — Private-document consent (moved up; P0 order) and persistence correctness
See Batch 3 content for consent; consent table + UI step + function check ships here, right after Batch 1.

### Batch 2b — Abuse and cost controls (P1)
New migration: `rate_limits` table + atomic `consume_rate_limit(user, action, window, max)` RPC and a per-user daily token budget; shared helper used by all AI-calling functions; tests with two simulated users. Migration is additive; rollback script provided (drop function/table).

### Batch 3 — Private-document consent and persistence correctness (P1/P2)
Consent table + UI step before upload processing; function-side consent check. Atomic conversation/message/citation persistence RPC; ownership check for `conversation_id`; surface persistence failures. Add two-user RLS/RPC tests (LL-006, LL-020, LL-005). Additive migrations with rollback.

### Batch 4 — Provider abstraction (P1/P2)
`ModelProvider` interface, OpenRouter adapter (ZDR), mocked provider for CI, class-based eligibility, model allow-list, timeouts/fallback; embeddings record model id and dimension (LL-009, LL-024). Adapters for Gemini (paid) and Workers AI only after the evaluation shows value and you approve account setup. Live smoke tests optional, never in CI gate.

### Batch 5 — Evidence model and verifier (P1/P2)
Additive migration for `quote`, offsets, `version_id`, hashes, `embedding_model`, verification `content_sha256`; deterministic verifier module with unit tests (fabricated section, altered quote, cross-user chunk, stale version); structured claim output with fallback to `source_extract` (LL-007, LL-021 partly). Server-side verification RPC with audit log (LL-021).

### Batch 6 — Orchestrator and capabilities (P2)
Fixed-pipeline orchestrator with bounds and tracing; migrate `ask` first behind a flag, then `ask-user-document`, then `draft-document`. Capabilities: research/retrieval, composer, verifier, document intelligence; then rights information and scenario analysis. No write-capable tools; no autonomous actions (LL-030…LL-033).

### Batch 7 — Retrieval quality and evaluation (P2)
Eval question schema and runner (questions authored by counsel); hybrid retrieval fusion; index rebuild/HNSW recall test; reranker trial on class A (LL-008, LL-022, LL-034). Corpus artefact clean-up and active-version record (LL-011).

### Batch 8 — Product polish (P3)
CORS restriction, triage improvements and multilingual phrasing, stale-processing reaper, UI display of version/effective-date/currency (LL-012, LL-023, LL-026).

## Definition of done per batch
Targeted tests pass; `tsc`, lint, `next build` and `deno check` pass in CI; migration applied to staging and re-run once to prove idempotence where applicable; diff reviewed; register updated; rollback documented.

## Final report (at the end of Stage 2)
Issues fixed with evidence; features added; providers/models and rationale; agents/tools and permission boundaries; files changed; migrations and reversibility; commands/tests actually run with results; remaining risks and manual configuration; deployment steps (not executed).
