# Staging and production deployment checklist

This runbook deploys the Next.js app and Supabase Edge Functions, then validates
the live ask and legal-search endpoints. Use a staging Supabase project first.
Do not run the admin review helper as written: it uses the service-role key to
approve the first pending corpus version it finds, rather than exercising the
admin user's RLS permissions or testing rejection.

## 1. Required values and where they belong

| Variable | Used by | Where to configure it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js browser client | Vercel project environment, for Preview and Production separately |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js browser client | Vercel project environment; this is the publishable/anon key, not the service-role key |
| `SUPABASE_URL` | Supabase CLI smoke test | Set in the shell running the smoke test; Edge Functions receive it from Supabase |
| `SUPABASE_ANON_KEY` | Supabase CLI smoke test | Set in the shell running the smoke test; Edge Functions receive it from Supabase |
| `OPENAI_API_KEY` | `ask`, document processing and document Q&A | Supabase Edge Function secret |
| `ANTHROPIC_API_KEY` | `ask` and document Q&A answer generation | Supabase Edge Function secret |
| `RATE_LIMIT_BACKEND` | `ask` Edge Function audit behavior | Supabase Edge Function secret; use `memory` unless the database audit table has been deployed |
| `SUPABASE_AUTH_EMAIL` | Live smoke-test login | Staging-only test user credentials in the shell/CI secret store |
| `SUPABASE_AUTH_PASSWORD` | Live smoke-test login | Staging-only test user credentials in the shell/CI secret store |
| `SUPABASE_PROJECT_REF` | Supabase CLI target | Deployment shell or CI secret/variable; project ref is not a credential |

Never add `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or
`ANTHROPIC_API_KEY` to a `NEXT_PUBLIC_*` variable or the web app's `.env` file.
The `SUPABASE_SERVICE_ROLE_KEY` must not be needed for the user-facing
smoke-test script.

## 2. Prepare the project

Install and authenticate the Supabase CLI, then link the intended staging
project. Check the project ref carefully before applying SQL or deploying:

```powershell
npm install --global supabase
supabase login
$env:SUPABASE_PROJECT_REF = "your-staging-project-ref"
supabase link --project-ref $env:SUPABASE_PROJECT_REF
```

The database setup currently lives in root-level SQL scripts, not in
`supabase/migrations/`. Apply `database/schema.sql`,
`database/waitlist_migration.sql`, then `database/user_documents_migration.sql`
in the linked project's Supabase Dashboard SQL Editor. The document migration
is additive and safe to re-run. Apply the initial `schema.sql` only once to a
fresh database; it contains non-idempotent policy creation statements. Do not
run `supabase db push` until the project has versioned migrations; it will not
apply these root-level SQL files.

After schema application, verify in the SQL Editor that:

- `public.rate_limit_events` exists and has RLS enabled.
- `public.match_document_chunks(vector, float, int)` exists and execute is
  restricted to `authenticated`.
- an ordinary test user cannot read unverified versions or their sections.
- the staged admin account has `app_metadata.role = "admin"` and can read the
  review queue.
- there is at least one correctly reviewed, verified, current version with
  embedded chunks for the ask-path test.

In Supabase Auth project settings, review the access-token expiry, inactivity
and maximum session lifetime policies, refresh-token reuse detection, email
confirmation and password policy. Require MFA for administrator accounts.
Test expiry, refresh, local logout, and global logout using dedicated staging
accounts before production.

The document feature uses a private Storage bucket named `user-documents`,
limits each upload to 15 MiB, and limits each account to 20 file reservations
(at most 300 MiB using the bucket's per-file limit). It
supports PDF, DOCX, and UTF-8 TXT. Scanned/image PDFs without selectable text
fail processing; OCR is intentionally not configured. Extracted text is sent
to OpenAI for embeddings and relevant retrieved passages are sent to Anthropic
for answering. The Documents page requires user acknowledgement before upload.

## 3. Set Edge Function secrets and deploy

Supply key values from a password manager or CI secret store; do not commit
them or paste them into a tracked file. In PowerShell, use the following
command shape with values supplied by your secret manager:

```powershell
supabase secrets set --project-ref $env:SUPABASE_PROJECT_REF `
  OPENAI_API_KEY="your-openai-api-key" `
  ANTHROPIC_API_KEY="your-anthropic-api-key" `
  RATE_LIMIT_BACKEND="memory"

supabase functions deploy ask --project-ref $env:SUPABASE_PROJECT_REF
supabase functions deploy legal --project-ref $env:SUPABASE_PROJECT_REF
supabase functions deploy create-user-document-upload --project-ref $env:SUPABASE_PROJECT_REF
supabase functions deploy process-user-document --project-ref $env:SUPABASE_PROJECT_REF
supabase functions deploy ask-user-document --project-ref $env:SUPABASE_PROJECT_REF
supabase functions list --project-ref $env:SUPABASE_PROJECT_REF
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are supplied by the Supabase Edge
Function runtime; do not set them as secrets manually. Deploy without disabling
JWT verification.

The current `RATE_LIMIT_BACKEND=supabase` path only records rate-limit audit
events; it does **not** implement a shared atomic quota across Edge Function
instances. The in-memory limiter remains instance-local. Consequently this
configuration is not a production-grade distributed rate limiter, and the
production release gate below remains blocked until a shared atomic limiter
(for example, a transaction-backed RPC or external rate-limit service) is
implemented and tested.

## 4. Configure and build the web app

In the Vercel project, set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` for the matching Preview/Production environment.
Do not set server secrets as `NEXT_PUBLIC_*` values.

Build locally before promoting:

```powershell
Push-Location apps/web
npm ci
npm run build
Pop-Location
```

Deploy a Preview/staging build first. Confirm sign-in, dashboard access, and
the protected admin route against the staging Supabase project before promoting
the same commit to Production.

## 5. Run live endpoint smoke tests

Use a dedicated staging test account. It must be an ordinary authenticated
user, not an admin or service-role token. In PowerShell, set the URL, anon key,
and test credentials from the staging secret store, then run:

```powershell
$env:SUPABASE_URL = "https://your-staging-project-ref.supabase.co"
$env:SUPABASE_ANON_KEY = "your-staging-anon-key"
$env:SUPABASE_AUTH_EMAIL = "staging-smoke-user@example.test"
$env:SUPABASE_AUTH_PASSWORD = "staging-test-user-password"
node .\scripts\validation\supabase-e2e-smoke.mjs
```

The script signs in through Supabase Auth, calls `/functions/v1/ask`, then
calls `/functions/v1/legal?mode=search`. Both endpoints must return success;
inspect the answer and citations, not only the HTTP status. A passing response
does not establish answer quality by itself.

Clear the credentials from the current PowerShell process when finished:

```powershell
Remove-Item Env:SUPABASE_URL, Env:SUPABASE_ANON_KEY, Env:SUPABASE_AUTH_EMAIL, Env:SUPABASE_AUTH_PASSWORD
```

The script currently exits successfully when required variables are absent.
Before treating a CI invocation as a release gate, make it fail on missing
configuration or assert that its output contains successful results; a skipped
smoke test must not be mistaken for a pass.

After applying `database/user_documents_migration.sql` and deploying all three
document functions,
test document processing in staging with a non-sensitive text-based PDF,
DOCX, and TXT, plus a scanned PDF that must be rejected with a clear message.
Verify a second ordinary account cannot list, download, question, or cite the
first account's document. Check that retrying processing does not leave duplicate
chunks, the per-account quotas reject excess records, and deleting a document
removes its private object, chunks, questions, and citations.

## 6. Exercise admin approval and rejection in staging

Perform this through the deployed admin UI with the staging admin account and
a disposable, unverified corpus version:

1. Confirm an ordinary user cannot see the test version or its sections.
2. Sign in as the admin, open the corpus review page, expand the test version,
   and inspect the source text and attribution.
3. Verify the test version with reviewer notes. Confirm the database records
   `verified`, `verified_by`, `verified_at`, `review_notes`, `reviewed_by`, and
   `reviewed_at`, and that an ordinary user can now retrieve it.
4. In a separate disposable version, reject it with notes. Confirm it remains
   unverified, has `status = 'rejected'`, and stays invisible to ordinary users
   and retrieval.
5. Confirm a non-admin cannot perform either review action.

Do not run `scripts/validation/admin-review-flow.mjs` against production or
staging as currently implemented. It selects the first pending version and
updates it with a service-role key; it neither tests admin RLS nor tests both
decisions. Replace it with a controlled fixture-based test before automating
admin review mutations.

## 7. Assistant and retrieval release checks

- Ask a question with a known verified source. Check the answer against that
  source and confirm every returned citation identifies a retrieved chunk.
- Ask a question outside the corpus and confirm the assistant declines to
  speculate.
- Test a high-risk prompt and confirm the safety-first response is returned.
- Confirm the source URL and section label shown for citations match the
  verified version.
- Review a small, documented legal-question benchmark set before changing
  similarity thresholds or promoting a new retrieval-ranking version.
- Check Edge Function logs for provider, retrieval, persistence, and rate-limit
  failures after the smoke tests.

## Release gate

Do not promote to production until staging checks pass, a human reviewer has
exercised both approval and rejection, a verified source is searchable, the
assistant's answers and citations have been reviewed, and the production
rate-limiter has shared atomic enforcement. The live smoke test is not a
substitute for these checks.
