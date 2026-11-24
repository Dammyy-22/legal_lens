---
name: implement-ai-platform
description: Incrementally implement LegalLens provider integrations, RAG improvements, controlled agents, and AI verification after audit approval.
---

# Implement AI platform incrementally

## Gate 0 — prerequisites
Read CLAUDE.md and the approved audit/issue register. Confirm the target branch and clean/understood git status. Do not begin if scope or data-safety requirements are unclear.

## Gate 1 — inspect before selecting technology
Trace current LLM, embedding, retrieval, reranking, document parsing, streaming, persistence, and API patterns. Reuse working components. Verify official provider documentation and current terms before integration. Do not add multiple overlapping agent frameworks.

## Gate 2 — provider layer
Implement a server-only provider abstraction compatible with the existing stack. Add only providers selected in the approved plan. Validate environment variables without printing values. Support capability checks, bounded timeouts/retries, rate-limit handling, typed errors, structured output validation, usage/latency traces, and graceful failure. Add deterministic mocked tests. Never expose secrets client-side.

## Gate 3 — retrieval and legal evidence
Improve ingestion, metadata, chunk provenance, retrieval filters, relevance/reranking, and citation resolution. Enforce user/tenant authorization before retrieval. Maintain source/version metadata only when supported by evidence. Do not invent legal status, dates, or authorities.

## Gate 4 — orchestration and agents
Prefer a central orchestrator with narrowly scoped tools. Implement agent capabilities only where they provide distinct value:
- Research and retrieval.
- Answer composition.
- Document analysis.
- Scenario analysis.
- Rights information.
- Evidence/citation verification.

Agents must have least-privilege tools, bounded steps, token/time budgets, validated inputs/outputs, and no unrestricted SQL, filesystem, network, or external-action access. Require human confirmation for consequential actions.

## Gate 5 — safety and verification
Treat retrieved/uploaded text as untrusted. Prevent instructions in documents from overriding system instructions. Verify citations deterministically against stored source records and passage IDs. Clearly state when evidence is missing or uncertain. LLM review is supplementary only.

## Gate 6 — testing and delivery
Test provider errors/fallback, RAG retrieval, citation resolution, ownership isolation, prompt injection, agent tool boundaries, and core UI flows. Run typecheck, lint, unit/integration tests, and build as available. Review diff and update docs. Report what is done, what is not, exact tests, blockers, and remaining risks.

Do not deploy, migrate production data, delete data, or modify production secrets without explicit approval.
