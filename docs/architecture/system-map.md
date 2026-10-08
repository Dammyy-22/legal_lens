# LegalLens system map

## 1. Runtime architecture

- Frontend: `apps/web` (Next.js)
- Identity: Supabase Auth
- API layer: Supabase Edge Functions in `supabase/functions/`
- Data store: Postgres in Supabase with RLS enabled
- AI providers: OpenAI for embeddings, Anthropic for answer generation
- Corpus management: ingestion scripts under `scripts/ingestion/`

## 2. Request flow

### Search flow

1. User signs in through Supabase Auth.
2. The browser calls `legal` Edge Function with an Authorization header.
3. The function validates the JWT via `supabase.auth.getUser()`.
4. The function loads only verified/current corpus rows.
5. The result set is filtered and returned to the frontend.

### Ask flow

1. Browser posts the question to `ask` Edge Function.
2. Function validates the user and checks the question for obvious bad inputs.
3. Function applies a rate-limit guard and safety triage.
4. Function embeds the question with OpenAI.
5. Function retrieves similar verified chunks via `match_document_chunks`.
6. Function checks whether enough evidence was found.
7. Function calls Anthropic with only the retrieved content as context.
8. Function validates all model citations against real retrieved chunk IDs.
9. Function persists the user message and assistant answer to Postgres.
10. Response is returned to the user, with `uncertain` and `risk_level` metadata when needed.

## 3. Security boundaries

- User-facing code may never contain a service-role secret.
- Only the ingestion path and trusted admin tooling may populate or verify corpus rows.
- App users can only access their own conversations and their own citations.
- Verified corpus content is the only data available to normal users.
- Admin users may review unverified versions, but they cannot bypass the verified-only app-facing logic.

## 4. Admin workflow map

- Ingestion creates `legal_source_versions` rows as unverified.
- Admin reviews the raw sections and decides to verify or reject.
- Verified rows become visible to full app users.
- Rejected rows remain hidden but retain review notes for auditability.

## 5. Operational risks

- Retrieval quality is still simple keyword/vector matching rather than a production legal retrieval stack.
- The in-memory rate-limit prototype is a start, not a full production control.
- AI output must remain conservative and uncertainty-based until the corpus is large and well-reviewed.
- Human verification remains the gate for publication.
