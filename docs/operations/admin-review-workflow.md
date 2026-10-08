# Admin review workflow

## Purpose

Legal content is not published until a reviewer confirms that it is accurate, attributed, and useful for the app.

## Flow

1. Ingestion creates a `legal_source_versions` row with `verified = false`.
2. Admin accesses the corpus review page.
3. Admin opens the version, reads the extracted sections, and records any issue or note.
4. Admin chooses either:
   - `Verify and publish`
   - `Reject and note`
5. The action updates `review_notes`, `reviewed_by`, `reviewed_at`, and the relevant publication status.
6. Verified content becomes visible to the application and AI assistant.
7. Rejected content remains hidden while preserving audit history.

## Data fields

- `status`: `current`, `rejected`, `unverified`, etc.
- `review_notes`: short human-readable reviewer notes
- `reviewed_by`: reviewer identity
- `reviewed_at`: timestamp of the decision

## Governance guidance

- Every published version should have a human reviewer behind it.
- Rejected versions must not silently reappear.
- The app should treat the review process as an operational control, not a UI decoration.
