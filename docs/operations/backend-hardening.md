# Backend hardening and guardrails

## What was implemented

This pass added the first operational guardrails around the ask flow:

- Request validation before OpenAI/Anthropic calls.
- User-scoped rate limiting prototype in the `ask` edge function.
- Structured rejection when the model cannot produce a trusted answer.
- Explicit handling for empty generation output.
- Logging around retrieval and citation failures.

## Why this matters

The legal assistant is a high-trust product. It must never guess, invent citations, or work off unverified data. The hardening improvements reduce abuse, noisy failures, and low-quality outputs without weakening the published truth model.

## Remaining production work

1. Move rate limiting to an edge gateway or a dedicated API throttling layer.
2. Add request correlation IDs and structured logs.
3. Add per-user quotas and abuse alerts.
4. Add a dead-letter / retry path for API timeouts and 5xxs.
5. Run a live smoke test against a staging Supabase project before production release.

## Prototype status

The current rate-limit guard is intentionally lightweight and in-memory. It is suitable as a prototype, not as the final rate-limiting strategy for a production public API.
