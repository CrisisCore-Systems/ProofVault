# Demo Fixture Pack

This directory is reserved for the reproducibility fixture that accompanies a named Trust Case release.

The fixture should be generated from a frozen build and should let another reviewer reproduce the core claims in the trust dossier without relying on unpublished context.

## Current contents

- `CASE_NOTES.md`
- `SPECIMEN_BASELINE.md`
- `EXPECTED_OUTPUTS.json`
- `proofvault-trust-case-specimen-full-2026-03-13T16-20-00-000Z.zip`
- `proofvault-backup-2026-03-13.pvault`
- `manifest-2026-03-13T16-20-00-000Z.json`
- `proof-vault-evidence.json`
- `FINGERPRINT.txt`
- `proofvault-verification-report.json`
- `proofvault-verification-report-tampered.json`
- `proofvault-verification-certificate.html`

The expanded scenario matrix is recorded in `EXPECTED_OUTPUTS.json` under `fixture.matrix`. The repo keeps one pinned public specimen ZIP plus one pinned encrypted backup, then records the additional redacted, minimal, missing-attachment, wrong-backup, stale-manifest, and rollback outcomes as deterministic expectation data instead of checking in multiple redundant archives.

## Important rule

Do not invent fixture outputs by hand.

Only publish artifacts actually emitted by the application build under review.

The current fixture was generated from the repository using the deterministic harness in `src/lib/export/trustCaseFixture.test.ts`.

The certificate artifact is currently HTML because the application renders a print-ready certificate document rather than exporting a PDF file directly.