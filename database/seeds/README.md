# Seed data

`constitution_chapter_4_seed.sql` contains real, verified text of Chapter IV
(Fundamental Rights, Sections 33-46) of the Constitution of the Federal Republic of
Nigeria 1999, as updated with the 1st-5th Alterations (2010-2023).

**Source:** Policy and Legal Advocacy Centre (PLAC) official consolidated PDF —
https://placng.org/i/wp-content/uploads/2023/05/Constitution-of-the-Federal-Republic-of-Nigeria-2023.pdf
PLAC is a recognized Nigerian civil-society legal advocacy organization; per the PDF's
own foreword, this consolidation was built from the original 1999 print and National
Assembly alteration acts. Retrieved via web fetch on the date this file was created —
see `retrieved_at` in the seed data itself.

**Why this text and not another source:** A parallel fetch from a `.gov.ng` domain
(nigeriarights.gov.ng) had PDF-extraction corruption (dropped leading characters on
wrapped lines throughout), making it unreliable for verbatim citation. The PLAC PDF
extracted cleanly. Both are legitimate; this one was chosen for text quality, not
authority — the person building this product should still independently confirm
against an official Government Gazette printing before treating this as
production-grade "verified" content (see `verified = false` in the seed itself).

**Status: `unverified` in the schema, and it should stay that way** until a qualified
human reviewer has actually diffed this text against an official Gazette printing.
This ingestion demonstrates the pipeline working end-to-end with real content — it is
not, by itself, sufficient sign-off to treat this as authoritative in production.
Nothing in this app currently reads or displays this content (the Constitution page
in apps/web still correctly shows "not yet ingested" — updating that UI to read from
this table is a separate follow-up, not done here).
