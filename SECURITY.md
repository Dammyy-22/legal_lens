# Security posture and OWASP Top 10 (2025) mapping

This is a code-and-configuration status map, not a certification or penetration
test. Controls marked "partial" need staging evidence or additional engineering
before production use. LegalLens uses Supabase Auth, Postgres RLS, and Edge
Functions; security claims from the retired FastAPI design do not describe the
current implementation.

## Session management

- The browser and server use `@supabase/ssr`; the Next.js `proxy.ts` refreshes
  the Supabase session and makes an optimistic redirect for unauthenticated
  dashboard requests.
- The protected dashboard layout and admin page independently call
  `supabase.auth.getUser()`. Authorization is not granted by a client-side
  session check or by Proxy alone.
- Supabase access tokens are bearer JWTs. A global sign-out revokes
  refreshable sessions, but an already-issued access token can remain valid
  until its expiry. Sensitive data access must continue to rely on RLS and
  server-side identity verification.
- Sidebar sign-out revokes the current local session. Account Settings offers
  global session revocation.
- OAuth callback redirects accept only local paths, preventing an untrusted
  `next` parameter from redirecting a signed-in user to an external site.
- Supabase SSR cookies are managed by the SDK. Do not assume the auth token
  cookie is `HttpOnly`: browser auth flows need client-side access. Protect
  state-changing actions with authorization and appropriate CSRF controls; do
  not copy tokens into application-managed cookies or local storage.
- Configure and periodically review Supabase Auth session lifetime,
  inactivity, refresh-token reuse detection, password policy, email
  confirmation, and MFA settings in the project dashboard. Require MFA for
  administrator accounts before production. These project-level settings
  cannot be guaranteed by the application code alone.

## Private document controls

- Documents are uploaded into the private `user-documents` Storage bucket using
  short-lived signed upload tokens created only after the authenticated user
  reserves an owner-bound database row.
- Direct authenticated Storage inserts are disabled; object keys are generated
  under the authenticated user's ID. The bucket enforces a 15 MiB object limit.
- A trigger serializes per-user reservations and caps a user at 20 documents.
  Processing independently confirms the object owner, size, declared MIME,
  file signature for PDF/DOCX, and extracted-text/chunk limits.
- Metadata and Q&A tables use RLS; vector retrieval is a `SECURITY DEFINER`
  RPC that requires `auth.uid()` to own the selected, ready document. Composite
  foreign keys keep answer citations attached to chunks from the same document.
- Service-role processing is confined to Edge Functions and happens only after
  user JWT validation and a document-owner lookup. It is not returned to the
  browser.
- PDF, DOCX, and UTF-8 TXT are supported. Scanned PDFs are rejected; OCR is not
  enabled. Uploaded text is sent to OpenAI for embeddings and retrieved excerpts
  are sent to Anthropic for answer generation, after explicit UI acknowledgement.
- Deletion removes the private Storage object and then deletes the DB record;
  cascading foreign keys remove chunks, Q&A, and passage references.

These controls need live staging tests with two users. In particular, verify
cross-user storage download denial, processing denial for another user's ID,
signed upload limits, and deletion/cascade behavior before production.

## OWASP Top 10:2025 status

| Category | Current controls | Remaining work |
|---|---|---|
| A01 Broken Access Control | RLS on corpus, conversations, and private user documents; owner-checked upload and processing; document-scoped RPC verifies `auth.uid()`; admin role comes from trusted `app_metadata`. | Verify all policies and RPC grants on the live project, test cross-user storage/database access, and keep admin review mutations restricted to admins. |
| A02 Security Misconfiguration | Added `nosniff`, frame denial, referrer, permissions, and production HSTS headers. | CSP is not yet deployed; tighten Edge Function CORS; verify deployment secrets, Supabase Auth settings, and production headers with a scanner. |
| A03 Software Supply Chain Failures | Lockfiles are committed and CI builds the app/functions/schema. | Add dependency vulnerability scanning, review/update stale packages, pin CI actions to immutable revisions, and define an update response process. |
| A04 Cryptographic Failures | Supabase-managed auth and HTTPS service endpoints; secrets are intended for server-side storage. | Confirm database/backups encryption and key rotation with the provider; never expose service-role or AI provider keys to the browser. |
| A05 Injection | Supabase query builder/RPC parameters avoid hand-built SQL; retrieved corpus text is treated as untrusted prompt data; model citation IDs are validated against retrieved chunks. | Add prompt-injection and malformed-input regression cases; review any future SQL/RPC changes and HTML/rendering sinks. |
| A06 Insecure Design | Verified-only retrieval and refusal without adequate evidence are core safety controls. | Complete threat modeling, abuse cases, data-retention decisions, rate-limit/quotas, and review workflow testing before public launch. |
| A07 Authentication Failures | Supabase Auth, server-verified user identity, safe OAuth callback, local and global sign-out. | Enforce MFA for admins, verify email/password reset settings, tune session lifetime and auth rate limits, and test token revocation in staging. |
| A08 Software or Data Integrity Failures | Corpus publication requires human verification; citation FK/check constraints tie citations to real chunks. | Exercise ingestion and admin approval/rejection on staging; add provenance/checksum verification and controlled deployment review. |
| A09 Security Logging and Alerting Failures | Edge Functions log selected provider/retrieval/persistence failures; a `rate_limit_events` table and optional audit writes exist. | Audit-write errors are not a distributed enforcement mechanism; add reliable alerting, retention/redaction policy, admin audit events, and dashboards for auth anomalies, repeated failures, and abuse. |
| A10 Mishandling of Exceptional Conditions | Some backend failures return explicit error responses and log detail server-side. | Audit all error paths for fail-open behavior and success-shaped fallbacks; add end-to-end tests for provider outage, database failure, and expired/revoked sessions. |

## Browser response headers

Next.js config sets:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, microphone, and geolocation
- `Strict-Transport-Security: max-age=31536000` in production

Content Security Policy is intentionally not set yet. A useful CSP must account
for Next.js runtime scripts and the configured Supabase/Google endpoints;
introduce it in report-only mode, test the real deployment, then enforce it.

## Production session checklist

1. Set Supabase Auth access-token expiry and session/inactivity limits according
   to the product's risk and usability requirements.
2. Enable refresh-token reuse detection and review the resulting session
   revocation behavior.
3. Require MFA for all administrator accounts and retain a recovery process.
4. Verify email confirmation, password rules, reset URLs, redirect allowlists,
   and provider settings.
5. Test local logout, global logout, password reset, expired tokens, and
   cross-user RLS access in staging.
6. Confirm administrative RLS and database RPC permissions in the deployed
   project; the UI is not the security boundary.
7. Configure monitoring and alerts for auth errors, Edge Function failures,
   unusual request volume, and admin review changes.

## Incident and verification note

If a credential or session is suspected to be compromised, revoke sessions in
Supabase Auth, rotate the affected secret, and inspect provider and database
logs. Never paste credentials, tokens, or legal-user data into issue reports.
Use the staging checklist and security tests to verify the remediation before
promoting it to production.
