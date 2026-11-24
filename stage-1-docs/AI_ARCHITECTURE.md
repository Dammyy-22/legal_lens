# LegalLens — AI Architecture (current state and target design)

Status: **proposal for approval.** Nothing in this document has been implemented.

## 1. Current state

Three independent request pipelines inside Supabase Edge Functions, all calling one OpenRouter wrapper:

| Function | Purpose | Retrieval | Output |
|---|---|---|---|
| `ask` | Verified-corpus Q&A | pgvector (0.72, k=6) → FTS fallback | Free text + `[[cite:ID]]` tags, stripped and re-listed as citations |
| `ask-user-document` | Q&A over one private document | owner-scoped pgvector RPC | Free text + citations validated by ID |
| `draft-document` | Plain correspondence drafts | none (user facts only) | Free text draft |

No orchestrator, tools, agents, tracing, fallbacks or provider abstraction. Safety behaviour is hard-coded (regex triage, empty-retrieval refusal, prompt rules).

## 2. Framework decision

**Recommendation: no agent framework.** Use a small typed TypeScript orchestrator inside the existing Edge Function runtime.

Reasons: the existing code is already plain TypeScript with unit-testable `logic.mjs` modules; the required capabilities are a fixed pipeline with one bounded loop, not open-ended autonomy; Edge Functions favour small cold-start footprints; and the master prompt asks for one framework only if a need is demonstrated. Revisit if durable multi-step workflows or human-approval pauses outgrow Edge Functions (then evaluate a queue + worker, not an agent framework).

## 3. Target design

```
Client ─▶ Edge entrypoint (auth, rate/budget limit, input validation)
            │
            ▼
       Orchestrator  (fixed state machine, max steps, deadline, trace id)
            │  calls only registered capabilities via typed contracts
   ┌────────┼───────────┬──────────────┬──────────────┬───────────────┐
   ▼        ▼           ▼              ▼              ▼               ▼
 Research  Rights     Scenario      Document       Composer       Verifier
 /Retrieval info      analysis      intelligence   (answer)       (citations/evidence)
   │                                    │
   ▼                                    ▼
 Retrieval service (authorisation first)   Private-doc retrieval (owner check first)
   │
   ▼
 ModelProvider interface ─▶ adapters (OpenRouter-ZDR, Gemini paid, Workers AI)
```

### Capability contracts and permissions (least privilege)

| Capability | Reads | Writes | Provider data class | Notes |
|---|---|---|---|---|
| Legal research / retrieval | verified corpus via RLS client | none | A | Returns chunk IDs, text, source/version/section metadata. No generation |
| Rights information | verified corpus (filtered to rights topics) | none | A | Structured "what the source says" output; no advice |
| Scenario analysis | retrieval results + user facts | none | A | Must label assumptions; conditional language enforced by schema |
| Document intelligence | one selected `ready` private document (owner check) | `user_document_questions/answer_sources` via service role after owner check | B | Consent flag required; no cross-document access |
| Answer composition | retrieved evidence only | none | A/B | Emits structured claims, each pointing to evidence IDs |
| Citation / evidence verification | evidence store | none | none (deterministic code, no model) | Gate: answer is not released unless verification passes or is downgraded to "uncertain/excerpt" |

No capability can send email, file anything, contact a lawyer, or take any action outside the app. `draft-document` stays a **suggestion for the user to edit and send themselves**; any future consequential action requires explicit user approval in the UI.

### Orchestrator bounds

- Fixed pipeline; at most one retrieval retry (query rewrite) and one composition retry after a verifier failure.
- Hard limits per request: wall-clock deadline, max model calls (proposal: 4), max tokens, max retrieved chunks, max input size.
- Every step receives and returns schema-validated objects (proposal: Zod via `npm:zod`); a validation failure ends the request with a safe fallback, never a free-text retry loop.
- Per-user daily request and token budget, enforced in the database (see LL-003).
- Trace record per request: trace id, user id (hashed in logs), steps, provider/model, token counts, latency, retrieval chunk IDs, verifier outcome, final mode (`generated | source_extract | refused | safety`). No prompt/response text in logs for class B.

### Provider abstraction

```ts
interface ModelProvider {
  id: string
  dataClasses: Array<'A' | 'B' | 'C' | 'D'>   // which classes it may receive
  chat(req: ChatRequest): Promise<ChatResult>        // optional JSON-schema output
  embed?(input: string[]): Promise<EmbedResult>      // returns model id + dimension
  rerank?(q: string, docs: string[]): Promise<RerankResult>
}
```

Selection is by class eligibility, then health/timeout policy and ordered fallbacks. Embedding results carry model id and dimension, stored with each vector (see LL-024). Mocked providers implement the same interface for CI.

## 4. AI security controls (design requirements)

| Threat | Control |
|---|---|
| Direct prompt injection | User text only in the user channel, length-capped; system prompt never interpolates user text; output schema-validated |
| Indirect injection / retrieval poisoning | Retrieved text wrapped as data and escaped (exists); corpus rows reach retrieval only after admin verification (exists); add content-hash pinning at verification (LL-021); strip instruction-like patterns only for logging, never as a defence |
| Cross-user leakage | Authorisation before retrieval (exists for private docs via RPC); add automated RLS/RPC tests with two users (LL-005) |
| Sensitive-data disclosure | Class-based provider eligibility; ZDR enforcement; no prompt/response text in logs; consent record for class B |
| Unsafe file processing | Existing size/MIME/signature/page/character limits; keep OCR gateway private; add malware-scan decision (open since Phase 16 in `DECISIONS.md`) |
| Tool abuse | No write-capable tools exposed to the model; model proposes, deterministic code executes |
| Unbounded loops/cost | Fixed orchestrator bounds + DB-backed budgets |
| Fabricated law | Deterministic verifier; refusal/uncertainty over guess (see `RAG_AND_CITATIONS.md`) |

## 5. Migration approach

Strangler pattern: introduce the provider interface and orchestrator behind the existing endpoints with identical response shapes, switch one function at a time (`ask` first), keep the old path behind a flag until evaluation parity is shown. See `IMPLEMENTATION_PLAN.md` batches 4–6.
