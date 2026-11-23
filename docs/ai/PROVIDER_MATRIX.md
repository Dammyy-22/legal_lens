# LegalLens — Provider Matrix (Stage 1, desk research)

Researched 2026-11-23 from the providers' own documentation pages where they were retrievable; third-party summaries are labelled. **Model quality for Nigerian legal tasks has NOT been measured** — it must be decided by the evaluation set in `RAG_AND_CITATIONS.md`, not by this table. Provider terms change; every row needs re-checking at implementation time.

## Data classes (drives provider eligibility)

| Class | Content | Rule |
|---|---|---|
| A | Verified public legal text + a user's question (`ask`) | Question may contain personal facts → treat as personal data. Zero-retention / no-training routing required |
| B | Private user documents, OCR text, document questions (`ask-user-document`, `process-user-document`) | Only providers with documented zero retention **and** no training, plus explicit user consent. Otherwise do not send |
| C | Drafting inputs (`draft-document`) | Treat as class B (free-text personal facts) |
| D | Public-corpus ingestion (embedding public statutes) | Any provider whose terms allow it |

Applicability of Nigeria's data-protection law to these flows should be confirmed with qualified counsel; this document does not assess it.

## Matrix

| Provider | Free / paid | Data handling (source) | Production suitability | Notes for LegalLens |
|---|---|---|---|---|
| **Google Gemini API** | Free tier with lower limits; paid tier with higher limits. Example paid price seen: Gemini 3.1 Flash-Lite $0.25 in / $1.50 out per 1M tokens (ai.google.dev/pricing) | Pricing page: free tier "Used to improve our products: Yes", paid tier "No". Additional Terms (quoted in a Google GitHub issue): paid services' prompts/responses not used to improve products | **Paid tier only.** Free tier is unsuitable for classes A–C | Strong structured output / long context (not benchmarked here). Embedding dimensionality vs the 1536 index must be verified before use |
| **Groq** | Free and paid (not tabulated here) | console.groq.com/docs/your-data: inference data not retained by default; retained for batch/fine-tune and for reliability/abuse handling; ZDR self-serve in Data Controls. The page's meta description says "standard 30-day retention" — **Groq's own text is inconsistent**; customer data stored in US GCP buckets | Viable for class A **with ZDR enabled** | Low-latency fallback candidate. Embedding/rerank availability not verified |
| **NVIDIA NIM (build.nvidia.com)** | Free developer access, rate-limited (forum: ~40 RPM, not published per model) | NVIDIA forum FAQ: developer-program endpoints are for "research, development, and test use only"; production use needs an NVIDIA AI Enterprise licence | **Not for production** on the free API. Self-hosted NIM or a paid partner endpoint would be a separate evaluation | Exclude from the production path; usable for offline experiments on public text only |
| **Cohere** | Trial key (free, 1,000 calls/month) vs paid production key (docs.cohere.com/docs/rate-limits; going-live page) | Production key requires acknowledging terms; if usage is flagged as a sensitive use case, the key may be throttled like a trial key until Cohere approves. Retention/ZDR terms **not verified** | Paid key needed; sensitive-use approval may apply to legal use | Main value is **Rerank** (prod rate limit listed as 1,000 req/min) and Embed. Re-check ZDR before sending class B |
| **OpenRouter** | Pay-per-use aggregator; some models free | openrouter.ai/docs/guides/privacy/zdr: ZDR can be enforced per request (`provider.zdr: true`), per account, or per guardrail; `data_collection: "deny"` excludes providers that store/train; default is `allow`; endpoints with unknown policy are treated as retaining and training; ZDR does not cover plugins/tools such as web search | Viable **only with ZDR enforced** | Already integrated. Enforcement is the immediate fix for LL-002; the set of ZDR-eligible models is a subset and must be checked via OpenRouter's ZDR endpoint list |
| **Cloudflare Workers AI** | Free 10,000 Neurons/day; Workers Paid $0.011 per 1,000 Neurons beyond that (developers.cloudflare.com/workers-ai/platform/pricing) | developers.cloudflare.com/workers-ai/privacy: states zero data retention and no training on Customer Content for Workers AI; storage occurs if you add R2/KV/Vectorize/AI Gateway logging | Documented terms fit class A/B best of the six. Free-tier daily cap is far too small for production | Candidate for embeddings and private-document inference. Model catalogue quality for legal reasoning unmeasured. If AI Gateway is used, disable logging/caching for class B |

## Recommendation (provisional — subject to evaluation and your approval)

1. **Immediately (Batch 1):** keep OpenRouter but enforce `provider: { zdr: true, data_collection: "deny" }` on every request, with a model allow-list restricted to ZDR-eligible endpoints. This closes LL-002 without changing architecture.
2. **Provider abstraction (Batch 4):** one `ModelProvider` interface (chat, structured output, embeddings, rerank) with adapters for OpenRouter (default), Gemini paid tier, and Cloudflare Workers AI. Per-class eligibility is declared in config and checked at call time, so a class B request cannot reach an adapter not marked eligible.
3. **Class B (private documents):** default to the provider that documents zero retention + no training (Cloudflare Workers AI or ZDR-enforced OpenRouter), and require recorded user consent before any upload is processed.
4. **Reranking:** evaluate Cohere Rerank on class A only (public text + question) once a paid key and its sensitive-use status are confirmed.
5. **Exclude** NVIDIA NIM free API and any free tier whose terms permit training from all production paths.
6. **Groq:** optional low-latency fallback for class A only, with ZDR enabled, if the evaluation shows acceptable quality.

## Constraints that affect any change

- **Embeddings are not interchangeable.** The index is `vector(1536)` built from `text-embedding-3-small`. Switching embedding provider/model means re-embedding the whole corpus and every user document (or running a second index). Store `embedding_model` and dimension per row before any switch.
- **Selection criteria still to measure:** answer quality on Nigerian legal questions, latency (p50/p95 from Lagos), context window, JSON/tool-call reliability, embedding/rerank availability, rate limits at expected load, price per answer, and reliability. None of these has been benchmarked in this audit.
- **Open questions for you:** monthly budget, expected users, whether class B must stay processable at all, and whether a Nigeria/EU/US processing location matters to you.

## Sources consulted (2026-11-23)

- ai.google.dev/gemini-api/docs/pricing
- console.groq.com/docs/your-data
- forums.developer.nvidia.com (NVIDIA NIM FAQ and rate-limit threads)
- docs.cohere.com/docs/rate-limits and /docs/going-live
- openrouter.ai/docs/guides/privacy/zero-data-retention and provider-routing docs
- developers.cloudflare.com/workers-ai/platform/pricing and /workers-ai/privacy
