# Production deployment checklist

## Environment and secrets

- Configure Supabase project variables and secrets for the app and Edge Functions.
- Ensure `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are stored in the deployment secret manager, not in the browser bundle.
- Confirm `SUPABASE_URL` and `SUPABASE_ANON_KEY` are defined in the Next.js environment.
- Keep service-role credentials isolated to server-side ingestion and admin tooling only.

## Database checks

- Run `database/schema.sql` against the target Supabase project.
- Confirm RLS policies are active for legal corpus and conversation tables.
- Confirm `match_document_chunks` is present and can only be called by authenticated users.
- Verify that unverified content remains hidden to normal users.

## Application checks

- Validate login, protected routes, and dashboard access.
- Test ask flow with a logged-in user.
- Test empty retrieval behavior and safety-first behavior.
- Confirm admin review page works for admins and redirects ordinary users.

## AI reliability checks

- Test a known good legal question with a verified source.
- Test a no-source question to confirm the app refuses to speculate.
- Test a high-risk question to confirm the safety-first response path is triggered.
- Confirm all citations correspond to retrieved chunk IDs.

## Release gate

Do not ship to production until:

- the app is validated in a staging Supabase project,
- the admin review workflow is exercised by a real reviewer,
- at least one verified corpus version is live,
- and the assistant response quality is reviewed against a known benchmark set.
