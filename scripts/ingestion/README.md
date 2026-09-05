# Legal source ingestion

Fetches, checksums, extracts, chunks, embeds, and stores legal source documents into
Supabase. Run manually (not an Edge Function) since ingestion is a one-off/occasional
batch job, not a user-facing request path.

## Setup

```bash
cd scripts/ingestion
npm install
```

## Running the Constitution ingestion

Requires three environment variables — **never commit these, never expose the service
role key to a browser**:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
OPENAI_API_KEY=your-openai-key \
npm run ingest:constitution
```

## Running the local corpus ingestion

The repository's local `legal corpus/` folder can be ingested in one idempotent batch:

```bash
cd scripts/ingestion
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... npm run ingest:corpus
```

On Windows PowerShell:

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:OPENAI_API_KEY="your-openai-key"
npm run ingest:corpus
```

The command records each PDF's SHA-256 checksum and skips the same file on later runs.
It writes all versions as `unverified`; review the extracted text and explicitly publish
each approved version before it can be searched or cited. The local PDFs are ignored by
Git and use `local-corpus://...` provenance until official source URLs are supplied.

- `SUPABASE_SERVICE_ROLE_KEY`: from Supabase Dashboard → Project Settings → API. This
  key bypasses Row Level Security — that's required here (ingestion writes to
  admin-only tables) but is exactly why it must never reach client-side code.
- `OPENAI_API_KEY`: used for `text-embedding-3-small` (1536 dimensions, matching
  `database/schema.sql`). A different embedding provider/model can be substituted, but
  the vector column dimension in the schema must match.

## What this does NOT do

**It does not make the ingested content visible to the AI assistant or any user.**
Everything it writes is stored with `verified = false`. Row Level Security in
`database/schema.sql` means unverified content is invisible to the app entirely. A
human must review the ingested chapters (query `legal_sections` for this version) and
run:

```sql
update legal_source_versions
set verified = true, verified_by = '<your name>', verified_at = now(), status = 'current'
where id = '<version id printed at the end of the ingestion run>';
```

## Known limitation

This first pass chunks the Constitution at **chapter granularity**, not
section-by-section. The source PDF's text extraction is inconsistent — some chapters
retain clean section numbering, but Chapter IV (Fundamental Rights) does not. Rather
than ship section-level parsing that would silently mis-chunk the most-queried
chapter, this was deliberately deferred. See `DECISIONS.md` for the full reasoning.
Practical effect: a citation to Chapter IV content will say "Chapter IV — Fundamental
Rights," not a specific section number, until section-level parsing is built.

## Verification status

This script has been type-checked (`tsc --noEmit`, zero errors) and its
chapter-splitting logic has been unit-tested against a realistic extraction fixture
(`test-chapter-split.mjs`) — including a specific regression check that Chapter IV is
correctly isolated despite lacking clean section-number prefixes.

**It has not been run end-to-end against the live source or a real Supabase project**
in this environment — the sandbox that built this has no network access to
`nigeriarights.gov.ng` or to Supabase/OpenAI's APIs. Please run it yourself and report
back what happens; treat the first real run as the actual test, not this description.
