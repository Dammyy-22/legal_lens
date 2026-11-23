# LegalLens — Security Audit (Stage 1, read-only, first pass)

Date: 2026-11-23. Method: code and configuration review plus tooling output (see `REPOSITORY_AUDIT.md` §4). This is not a penetration test. Items labelled *Confirmed* were seen in code or tool output; *Potential* need verification. No exploit was attempted and no secrets were read.

## Summary

No critical authentication, authorisation or secret-exposure defect was confirmed. The main risks are (1) vulnerable dependencies, (2) unenforced provider data policy for private content, (3) missing rate/cost limits, and (4) thin automated security testing.

## 1. Findings

| ID (register) | Severity | Status | Finding |
|---|---|---|---|
| LL-001 | High | Confirmed (version) / reachability unverified | `next@16.3.4` is within the range flagged by `npm audit` (1 critical advisory entry for `next`, covering multiple advisories including image-optimization and cache issues); `sharp` and `source-map-js` high. App uses `next/image`. Some advisories apply to self-hosted deployments only — hosting model unknown |
| LL-002 | High | Confirmed | No `provider.zdr` / `data_collection` on OpenRouter calls; OpenRouter's documented default is `allow`. Private-document text and questions are in scope |
| LL-020 | High | Potential | No consent step found before sending private documents to third parties (text search only) |
| LL-003 | Medium | Confirmed | No rate limiting on `ask-user-document`, `process-user-document`, `create-user-document-upload`, `legal`; `ask`/`draft-document` limits are per-isolate and reset across instances → paid-API cost abuse and brute-force surface |
| LL-021 | Medium | Potential | Corpus verification performed from the browser with client-supplied `verified_by`; admin policy permits any-column update; no audit log or content-hash pinning |
| LL-006 | Low–Med | Confirmed | Swallowed persistence errors; unchecked client-supplied `conversation_id` (RLS blocks cross-user writes — not an access-control bypass) |
| LL-012 | Low | Confirmed | CORS `*` on all functions (bearer-token auth limits impact) |
| LL-010 | Low | Confirmed | `supabase/.temp` committed (project ref, org id, pooler host; no password found); real project URL in ingestion README; these are identifiers, not secrets |
| LL-040 | Unknown | — | Hosted Auth settings (admin MFA, inactivity timeout, refresh-token reuse detection, email confirmation, password policy) cannot be verified from the repo; `SECURITY.md` itself says they are manual |
| — | Info | Confirmed | No Dependabot, secret scanning, CodeQL or SAST configuration in `.github` (only `ci.yml`) |

## 2. Controls verified as present

- Server-side JWT validation (`auth.getUser()`) in all six functions; `proxy.ts` plus per-page `getUser()` checks; safe-redirect helper for OAuth `next`.
- RLS enabled on all corpus, conversation and user-document tables; revoke/grant statements restrict `authenticated` to select/insert/delete as needed; SECURITY DEFINER functions set `search_path = public` and are revoked from `public/anon`.
- Admin identity derived from `app_metadata` (not user-editable).
- User-document ownership enforced in four places: RLS, owner-bound composite FKs, `match_user_document_chunks` owner+ready check, service-role queries pinned to `owner_id = user.id`.
- Storage: private bucket, MIME allow-list, 15 MiB limit, per-user folder policies, no direct authenticated inserts, signed upload tokens.
- Upload processing: size match, MIME/signature checks, DOCX archive-size check, page/character limits, OCR page cap, HTTPS-only OCR gateway URL, constant-time gateway key comparison.
- Input limits: question length, body-size caps on document functions.
- Prompt hygiene: untrusted text escaped and fenced; rules say sources are data.
- No hard-coded keys, JWTs or private keys found by pattern scan of tracked source files (JSON/TXT corpus files excluded from that scan).

## 3. AI-specific threat review

See table in `docs/ai/AI_ARCHITECTURE.md` §4. Current-state notes:

- **Indirect injection:** the corpus is admin-verified, which is a good gate, but verification is not bound to a content hash (LL-021). User documents are retrieved only for their owner and only into that owner's own Q&A, which limits blast radius to self-inflicted injection.
- **Cross-user leakage:** design is sound on paper; there are no automated two-user RLS/RPC tests (LL-005).
- **Tool abuse / agent loops:** not applicable today (no tools, single model call per request).
- **Output safety:** no PII redaction before provider calls; no output filtering beyond citation ID stripping.

## 4. Recommended remediation order

1. Upgrade Next.js and flagged packages; add Dependabot/audit gate (LL-001).
2. Enforce ZDR/no-collection on every provider call; add provider-eligibility by data class (LL-002).
3. Add a consent record and UI step before any private document is processed (LL-020).
4. DB-backed atomic rate and cost limiter on every AI-calling function (LL-003).
5. Move corpus verification behind a server-side RPC that records actor, time and content hash in an append-only log (LL-021).
6. Add two-user RLS/RPC tests and a secret scan to CI (LL-005).
7. Restrict CORS; remove committed `.temp`; rotate nothing unless a secret is later found (LL-010, LL-012).
8. Confirm hosted Auth settings and require admin MFA (LL-040).
