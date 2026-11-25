# LegalLens — Performance & Scalability Report

## 1. Test Methodology & Environment
- **Environment:** Local Windows host, Node.js, production Next.js `16.4.6` server (`next start -p 3111 -H 127.0.0.1`).
- **Scope Tested:** Controlled progressive concurrency load test (`1`, `5`, `10`, `25`, `50` concurrent virtual users) against prerendered/SSR frontend routes (`/` and `/auth/login`), plus static bundle measurement under `apps/web/.next/static/chunks`.
- **Scope NOT TESTED:** Backend Edge Function concurrency, PostgreSQL query latency under load, pgvector recall/throughput, OCR gateway GPU/CPU stress, and OpenRouter end-to-end streaming/latency — **no isolated staging database or mocked Edge runtime was modified or spun up** in strict read-only audit mode.

---

## 2. Measured Local Frontend Load Test Results

| Endpoint | Concurrency | Total Requests | Throughput (RPS) | Avg (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Errors | Payload |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | 1 | 20 | 36.1 | 27.7 | 25.7 | 49.9 | 49.9 | 0 | 57,073 B |
| `/` | 5 | 20 | 82.8 | 59.7 | 56.8 | 73.6 | 73.6 | 0 | 57,073 B |
| `/` | 10 | 40 | 96.0 | 102.4 | 98.4 | 129.8 | 130.6 | 0 | 57,073 B |
| `/` | 25 | 100 | 97.2 | 248.2 | 256.1 | 290.2 | 305.5 | 0 | 57,073 B |
| `/` | 50 | 200 | 120.4 | 401.3 | 412.6 | 519.1 | 535.1 | 0 | 57,073 B |
| `/auth/login` | 10 | 40 | 79.0 | 125.0 | 100.9 | 235.9 | 236.3 | 0 | 12,090 B |

**Observations:**
- Zero HTTP or socket errors across all 420 requests up to 50 concurrent users.
- Static/prerendered `/` serves cleanly from Next.js cache (`x-nextjs-cache: HIT`, `cache-control: s-maxage=31536000`). Latency scales linearly with Node single-process concurrency on localhost (`27.7 ms` at 1 user → `401.3 ms` avg / `535.1 ms` P99 at 50 concurrent users).

---

## 3. Frontend Bundle & Client Rendering Analysis

Measured across `apps/web/.next/static/chunks` (`31` JS files, `2,190.9 KB` total uncompressed on disk):
- **Largest chunk:** `902.8 KB` (`1l8id9uvvlha1.js`) — houses Three.js / React Three Fiber (`KnowledgeGraphScene.tsx`), isolated behind `dynamic(() => import('./KnowledgeGraphScene'), { ssr: false })` and gated on desktop width (`>=1024px`), `>=4` CPU cores, WebGL capability, and `prefers-reduced-motion` off (`KnowledgeGraph.tsx:58-62`), pausing when offscreen or tab-hidden. Mobile/reduced-motion users receive a lightweight inline `<StaticGraph />` SVG and never download the `902.8 KB` 3D chunk.
- **Next largest chunks:** `246.3 KB`, `223.7 KB`, `155.8 KB`, `143.2 KB`, `110.0 KB`.
- **Animation & GPU hygiene:** Landing/dashboard motion uses `transform` and `opacity` (`motion` library + CSS keyframes) with `prefers-reduced-motion` honoured globally (`globals.css:405-428`).

---

## 4. Backend, Database & AI Performance Bottlenecks (Static Audit)

1. **`ARC-01` (HIGH) — Full-Corpus Download per `GET /legal` Request:** Downloads up to 10,000 chunks and 5,000 sections into Edge memory and scans every chunk in JS on every search or Constitution load, hitting PostgREST's 1,000-row cap.
2. **`DB-01` (MEDIUM) — Missing FK & GIN Full-Text Indexes:** Dynamic `to_tsvector('english', ...)` calculation + leading-wildcard `LIKE '%...%'` forces sequential scans across `document_chunks`.
3. **`DB-02` (MEDIUM) — Empty-Table `ivfflat` Vector Indexes:** Built with `lists = 100` / `lists = 50` before data exists, degrading ANN recall.
4. **`ARC-02` (MEDIUM/LOW) — Synchronous 300s OCR & Processing Inside Edge Function:** Blocks HTTP connection and risks Edge wall-clock termination, leaving documents stuck in `'processing'`.
5. **`AI-03` (MEDIUM) — Unbatched 300-Chunk Embedding Call:** Sends up to 900k chars in a single OpenRouter request with a 45s timeout (`EMBEDDING_BATCH_SIZE = 32` is unused).
6. **`PERF-01` (LOW) — Redundant `supabase.auth.getUser()` Network Round-Trips:**

#### `PERF-01` — Redundant `supabase.auth.getUser()` Calls Across Middleware and Server Components
- **Severity:** LOW | **Category:** Performance | **Confidence:** High
- **Affected Files:** `apps/web/proxy.ts:29-31`, `apps/web/app/dashboard/layout.tsx:11-13`, `apps/web/app/dashboard/admin/page.tsx:11-13`
- **Evidence:** `proxy.ts` matches almost all routes (including public `/` and `/auth/*`) and invokes `supabase.auth.getUser()` (a network round-trip to Supabase Auth). For `/dashboard`, `dashboard/layout.tsx` calls `getUser()` a second time, and `/dashboard/admin` calls `getUser()` a third time.
- **Impact:** Adds unnecessary Auth API latency on every page navigation and increases Supabase Auth rate-limit pressure under concurrent load.
- **Likelihood:** High
- **Recommendation:** Skip `getUser()` in `proxy.ts` for purely public routes when no auth cookie is present, and wrap the server `getUser()` helper in React `cache()` for request deduplication across `layout.tsx` and `page.tsx`.
