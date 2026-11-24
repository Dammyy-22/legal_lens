# Setting up a Supabase staging project (for testing migrations before production)

Why: database changes (like `user_consent_migration.sql`) must be tried on a copy first. Staging is a **second Supabase project** with its own URL, keys and data. Nothing you do there touches production.

1. **Create the project.** Supabase dashboard → New project → name it `legal-lens-staging`, same organisation. Check your plan's limit on number of projects first (free plans limit active projects; confirm on Supabase's current pricing page).
2. **Apply the SQL in this order** using Dashboard → SQL Editor (paste each file, Run):
   1. `database/schema.sql`
   2. `database/user_documents_migration.sql`
   3. `database/waitlist_migration.sql`
   4. `database/matter_management_migration.sql`
   5. `database/lexical_search_migration.sql`
   6. `database/user_consent_migration.sql`
   Do **not** run anything in `database/ci/` (CI-only stubs) and do not run `database/tests/` on a real project.
3. **Secrets for Edge Functions** (Dashboard → Edge Functions → Secrets, or `supabase secrets set --project-ref <staging-ref>`): `OPENROUTER_API_KEY` (a separate key with a low spend limit), plus the same variable names listed in `docs/operations/deployment-checklist.md`. Never reuse production service-role keys.
4. **Deploy the functions to staging:** `supabase functions deploy <name> --project-ref <staging-ref>` for `ask`, `legal`, `draft-document`, `create-user-document-upload`, `process-user-document`, `ask-user-document`.
5. **Point a Vercel Preview deployment at staging:** in Vercel → Project → Settings → Environment Variables, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the **Preview** environment only, with the staging project's values.
6. **Test checklist on the preview URL** (use a throwaway account):
   - Documents page: upload without ticking → blocked; tick → upload succeeds; Settings shows "consent given".
   - Withdraw in Settings → ask about the document → refused with a consent message.
   - Tick again on the Documents page → ask works.
   - Drafting: same pattern.
   - `ask` page answers a corpus question (needs some corpus data; see `database/seeds/` and the ingestion README).
7. Only after staging passes, repeat steps 2.6 (migration), 4 (functions) and the web deploy on production, **in that order**.

Alternative without a second hosted project: `supabase start` runs the stack locally in Docker (install the Supabase CLI first).
