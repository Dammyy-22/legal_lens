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
SUPABASE_URL=https://fhmxbjwvflgxdhvestqp.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=replace-with-your-service-role-key \
OPENAI_API_KEY=replace-with-your-openai-api-key \
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

The Constitution pipeline skips the table-of-contents pages and starts chapter
segmentation at the constitutional preamble. It stores Chapters I–VIII separately and
keeps the schedules in their own section, including the standalone "Schedules"
heading. The corrected splitter uses the `chapters-v3` version label so a previously ingested version with the same PDF
checksum does not suppress corrected ingestion.
The new version intentionally remains unverified; after reviewing it in staging,
publish it and mark the previous current version superseded in the same controlled
database change. Do not delete or silently overwrite the previously published
version.

To regenerate only the checked-in Constitution extraction and chunk artifacts after a
parser change, run from this directory:

```powershell
npm run test:constitution
node normalize-legal-corpus.mjs Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.pdf
node chunk-legal-corpus.mjs Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.json
```

- `SUPABASE_SERVICE_ROLE_KEY`: from Supabase Dashboard → Project Settings → API. This
  key bypasses Row Level Security — that's required here (ingestion writes to
  admin-only tables) but is exactly why it must never reach client-side code.
- `OPENAI_API_KEY`: used for `text-embedding-3-small` (1536 dimensions, matching
  `database/schema.sql`). A different embedding provider/model can be substituted, but
  the vector column dimension in the schema must match.
- `SKIP_EMBEDDINGS=true`: optional emergency mode when OpenAI credits are unavailable.
  The legal text and chunks are still ingested for verified lexical search, with null
  embeddings. Set it back to `false` later and re-ingest after adding OpenAI credits to
  enable semantic retrieval.

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

## Structure and limitations

The Constitution pipeline skips the table-of-contents pages and starts chapter
segmentation at the substantive headings after the preamble. The local normalized
corpus also produces section-level chunks where extracted boundaries are reliable.
Chapter-level citations remain the safe fallback where section structure cannot be
validated. Schedules are kept separate from Chapter VIII.

## Verification status

The ingestion scripts are type-checked and the Constitution splitter is tested
against a regression fixture and the checked-in extraction of the complete PDF.

Live validation is environment-specific. Before publishing, check that the version's
eight chapter records contain substantive text, schedules are separate, and embeddings
are present when semantic retrieval is required. Keep the prior published version
available until the replacement passes these checks.
