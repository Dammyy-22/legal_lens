# AI assistant reliability workflow

## Reliability contract

The assistant must answer only from retrieved verified legal text and must refuse to answer when evidence is insufficient.

## Current controls

- Retrieval uses verified-restricted corpus rows.
- Vector search explicitly filters to `verified = true` rows.
- The model must cite a real chunk ID using `[[cite:REF]]` syntax.
- Citation validation strips any invalid reference before returning content.
- High-risk prompts trigger a safety-first response instead of legal reasoning.
- Empty or malformed model output is treated as a failure.

## Reliability workflow

1. Validate the question.
2. Reject obviously unsafe or malformed queries.
3. Rate-limit the caller.
4. Embed the question.
5. Retrieve similar verified chunks.
6. If no evidence is found, stop and explain the uncertainty.
7. Generate the answer only from chunk text.
8. Validate citations.
9. Persist the exchange and flag uncertainty when needed.

## Quality evaluation plan

- Keep a benchmark set of common legal questions with expected source coverage.
- Track percentage of responses with valid citations.
- Track refusal rates when evidence is insufficient.
- Review examples where the answer sounded confident but had low evidence.
- Run regular manual evaluations for the Constitution and high-traffic rights topics.

## Operational note

The assistant is not a lawyer, and it should remain explicitly uncertainty-aware. Good reliability is a product choice, not just a technical one.
