# Staging verification report

## Scope
The goal was to verify the live Supabase staging environment for:

- frontend/backend environment separation
- project identity and reachability
- migration state and schema existence
- pgvector configuration
- Edge Function deployment
- auth/session behavior
- storage and RLS enforcement
- end-to-end legal-question workflow with citations

## Current verification status

### Status: partially blocked by missing staging runtime access

The project is configured with a real Supabase project URL in the local environment, but the required runtime/staging stack is not available from this execution environment.

## Evidence gathered

### 1) Local environment variables present
The following values are present in the local web environment file:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The project URL resolves to:

- `https://fhmxbjwvflgxdhvestqp.supabase.co`

### 2) Supabase local stack status
Command run:

```bash
supabase status
```

Result:

```text
linked_project:
  project_ref: fhmxbjwvflgxdhvestqp
  project_name: legal_lens
  org_slug: hnxuhuoorqswozciykom
error:
  code: LegacyStatusDbInspectError
  message: failed to inspect container health: Error response from daemon: No such container: supabase_db_legal_lens
```

This means the local Supabase container backing the project is not running in this environment.

### 3) Live endpoint reachability
Command run:

```powershell
curl.exe -sS -o NUL -w "HTTP %{http_code}\n" -H "apikey: $env:NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $env:NEXT_PUBLIC_SUPABASE_ANON_KEY" https://fhmxbjwvflgxdhvestqp.supabase.co/rest/v1/
```

Result:

```text
HTTP 401
```

This confirms the project is reachable and the configured anon key is accepted for network-level access, but it is not sufficient for a successful authenticated staging workflow without a valid staged session or proper service-side access path.

## What is blocked
The following checks cannot be completed from this environment without a live staging session or a running local Supabase stack:

1. migration execution against a reachable Postgres instance
2. verification that all required tables exist in staging
3. verification of pgvector configuration in the target DB
4. confirmation that all Edge Functions are deployed to the intended staging project
5. end-to-end auth flows using real email/password and OAuth flows
6. RLS enforcement checks with real users and admin accounts
7. storage policy validation in a live project
8. legal-question submission through the real Edge Function chain with citations and provider calls

## Locally testable work completed
The following checks were completed in the local codebase and passed:

### Authorization tests
Command run:

```bash
node --experimental-strip-types --test lib/admin-access.test.ts
```

Result:

- 4 tests passed
- 0 tests failed

### Production build integrity
Command run:

```bash
npm run build
```

Result:

- Next.js compiled successfully
- TypeScript check passed
- route generation succeeded for the dashboard and admin flows

## Outstanding actions for the authorised operator

1. Start or restore the required local Supabase stack, or connect to the actual staging Supabase project.
2. Run the SQL migrations in the same order used by the project docs and confirm the schema is applied.
3. Verify the required database objects exist:
   - `legal_sources`
   - `legal_source_versions`
   - `legal_sections`
   - `document_chunks`
   - `conversations`
   - `messages`
   - `citations`
   - `rate_limit_events`
   - any user-document and matter-management tables required by the deployment
4. Confirm the `match_document_chunks` function exists and `pgvector` is enabled.
5. Deploy the Edge Functions and confirm they are bound to the correct project.
6. Create a real staging admin user with the correct `app_metadata.role` / MFA requirement.
7. Test login, logout, session refresh, unauthorized access, conversation retrieval, and corpus review with real auth.
8. Verify document access and admin review flows against the live database with RLS intact.

## Final assessment
The app code base is in a better state for production hardening, but live staging verification remains blocked by missing project runtime access and a non-running Supabase local stack. The remaining production risk is environmental configuration and staging validation, not just code compilation.
