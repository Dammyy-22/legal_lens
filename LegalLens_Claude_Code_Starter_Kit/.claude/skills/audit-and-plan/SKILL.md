---
name: audit-and-plan
description: Perform a no-edit LegalLens repository audit and produce an evidence-based, prioritised remediation plan.
---

# Audit and plan

1. Confirm repository root and run `git status --short --branch`.
2. Preserve all uncommitted user changes.
3. Inspect README, manifests/lockfiles, source tree, routes, database schema/migrations, tests, CI, deployment files, and existing docs.
4. Trace core user flows end-to-end rather than judging isolated files.
5. Identify existing LLM providers, model calls, prompt templates, RAG, embeddings, reranking, ingestion, and citation logic.
6. Inspect auth, authorization, RLS, storage policies, secrets handling, and AI trust boundaries.
7. Run only non-destructive, relevant diagnostics available in the project.
8. Do not read `.env*` or secret values.
9. Do not edit code, install dependencies, run migrations, or deploy during this skill.
10. Write/update audit docs, avoiding duplicate documents if equivalents exist.

Classify every item as confirmed defect, potential risk, incomplete feature, improvement, or unknown. Include evidence, impact, priority, affected files, fix proposal, dependencies, and verification. Finish with a staged plan and ask for approval before implementation.
