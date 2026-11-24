# LegalLens — RAG and Citations

Status: current-state findings plus proposed design. Nothing here is implemented yet.

## 1. Current pipeline

1. **Ingestion (manual scripts):** fetch/normalise → structure detection → chunk → embed → store. Tables: `legal_sources`, `legal_source_versions` (`version_label`, `effective_date`, `status`, `verified`, `verified_by/at`), `legal_sections` (label, heading), `document_chunks` (text, `vector(1536)`).
2. **Visibility gate:** only `verified = true` versions are visible to users (RLS + explicit filter); admins verify in `/dashboard/admin`.
3. **Retrieval (`ask`):** cosine ≥ 0.72, top 6; if none, Postgres FTS over verified, current versions.
4. **Generation:** sources passed as escaped `<source ref="CHUNK_ID">` blocks; model must append `[[cite:CHUNK_ID]]`.
5. **Validation:** citation IDs not in the retrieved set are dropped; zero valid citations → `uncertain`.
6. **Response:** answer + citations (chunk id, source title, section label/heading, source URL).

## 2. Strengths

- Stable chunk IDs, section labels and source versioning exist; unverified content cannot be retrieved by end users.
- Exact-match reference tags instead of fuzzy text matching.
- Honest refusal when retrieval is empty; excerpt-only mode when generation is unavailable.

## 3. Gaps

| Gap | Issue |
|---|---|
| Validation checks the ID was retrieved, not that the text supports the claim; uncited text passes | LL-007 |
| No stored exact supporting passage per citation (only chunk ID); chunk text may change on re-ingestion | LL-007 |
| Version/currency of the cited provision is not shown or checked (`effective_date`/`status` stored but not surfaced in `ask` output) | LL-007 |
| No amendment-status or "source incomplete" signal | — |
| Four generations of Police Act chunks in git; live version unrecorded | LL-011 |
| Vector-then-FTS fallback, no fusion or reranking; ivfflat built at schema time | LL-022, LL-034 |
| No evaluation set or metrics | LL-008 |
| Embedding model identity not stored per row | LL-024 |

## 4. Proposed design

### 4.1 Evidence model
Add (in a reversible additive migration) to answer storage: `citations.quote` (exact span), `citations.quote_start/end` (offsets within the chunk), `citations.version_id`, `citations.chunk_text_sha256` (hash at answer time). Add `embedding_model` and `embedding_dim` to chunk tables. Add `content_sha256` to the verified version, recorded by a trigger/RPC at verification time so later edits invalidate verification.

### 4.2 Structured answers
Composer returns JSON validated against a schema:

```json
{
  "claims": [
    { "text": "…", "type": "source_statement | explanation | process_guidance",
      "evidence": [ { "chunk_id": "…", "quote": "…" } ] }
  ],
  "uncertainty": "none | partial_sources | no_sources",
  "missing_information": ["…"]
}
```

`source_statement` claims **must** carry at least one evidence quote; `explanation` and `process_guidance` claims must be labelled and may not introduce statutes, sections, cases, URLs or dates absent from evidence.

### 4.3 Deterministic verifier (no model call)
For every claim: (a) `chunk_id` was retrieved for this request and is visible to this user; (b) `quote` occurs verbatim (after whitespace/Unicode normalisation) in the stored chunk text; (c) section/instrument/year strings mentioned in the claim text appear in the evidence or its metadata; (d) the evidence version is `current` or labelled otherwise. Any failure drops the claim; if too few claims survive the response degrades to `source_extract` with an explicit message. Never repair a citation by guessing.

### 4.4 Retrieval
- Hybrid retrieval (vector + FTS) fused by rank (e.g. reciprocal-rank fusion), not fallback-only.
- Optional reranker (see `PROVIDER_MATRIX.md`) on class A only.
- Rebuild/choose vector index after data load (ivfflat reindex or HNSW) and measure recall against exact search.
- Return instrument type, jurisdiction (federal/Lagos), `version_label`, `effective_date` and `status` with each chunk and show them in the UI.
- When retrieved sources cover only part of the question, say so explicitly (`partial_sources`).

### 4.5 Ingestion hygiene
Record per chunk: source file checksum, normaliser/chunker version, embedding model, verification record. Keep one active chunk generation per source; archive others outside git.

### 4.6 Composition style (owner requirement: grounded but human)
Answers must read like a knowledgeable person explaining, not like pasted statute text, **without** loosening grounding: plain language, short paragraphs, "here is what the law says" kept visibly separate from "what that may mean for you", conditional wording where facts are missing, no invented sections or quotes. Style is enforced in the composer prompt and checked by the evaluation set (human-rated naturalness alongside the deterministic citation checks). Lawyers onboarded by the owner should review a sample of answers for both accuracy and tone.

## 5. Evaluation plan

**Question set:** build `evals/questions.jsonl` with 60–100 questions across the ingested instruments (Constitution, Police Act 2020, Labour Act, FCCPA, Lagos Road Traffic Law, etc.), plus: out-of-corpus questions (must refuse), ambiguous-jurisdiction questions, multi-section questions, adversarial/injection questions, and non-English or Pidgin phrasings.

**Important:** expected sources and answers must be authored or verified by a qualified Nigerian lawyer. I will not invent expected legal answers; the first deliverable of Stage 2 for this item is the schema and runner, with questions drafted by you/counsel.

**Metrics:** retrieval recall@k and MRR against expected chunk/section IDs; citation validity (deterministic); citation support rate (quote present and relevant); groundedness (claim-level, human-reviewed sample); refusal/uncertainty accuracy on out-of-corpus items; answer relevance (human-rated sample); latency p50/p95; provider failure handling.

**CI vs live:** CI runs the verifier, schema validation and mocked-provider end-to-end tests deterministically. Live-provider smoke tests are manual/optional and never gate merges.
