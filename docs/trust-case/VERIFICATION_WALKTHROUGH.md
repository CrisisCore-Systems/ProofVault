# Verification Walkthrough

## Goal

Demonstrate one end-to-end case that survives export, external verification, and tamper checking.

This walkthrough is the operational core of the trust case.

## Current specimen

This repository currently ships one frozen specimen:

- Case title: `Trust Case Specimen`
- Case ID: `case-trust-2026-001`
- Pinned commit: `bd968e91a1fd58384b2af2eb389402728c9980f3`
- Export mode: `full`
- Attachments included: yes
- Metadata appendix included: yes
- Export timestamp: `2026-03-13T16:20:00.000Z`
- Included record count: `2`

Observed generated artifacts:

- `proofvault-trust-case-specimen-full-2026-03-13T16-20-00-000Z.zip`
- `proofvault-backup-2026-03-13.pvault`
- `manifest-2026-03-13T16-20-00-000Z.json`
- `proof-vault-evidence.json`
- `FINGERPRINT.txt`
- `proofvault-verification-report.json`
- `proofvault-verification-report-tampered.json`
- `proofvault-verification-certificate.html`

## End-to-end procedure

### 1. Build the demo case

- create case `case-trust-2026-001`
- ingest one incident record and one attached PDF record
- keep one additional note excluded from export to prove selection boundaries
- preserve at least two pre-export ledger entries: `case.created` and `evidence.linked`

Observed evidence:

- attachment SHA-256: `192204ef68fceebc16f38cc1e8312882b3f36dfc407276795dd9c1c815dfd8f8`
- timeline includes `Access denial documented` followed by `Door notice scan`

### 2. Generate encrypted backup

Generated file:

- `proofvault-backup-2026-03-13.pvault`

Observed evidence:

- backup snapshot SHA-256: `a022149b5360440b2836cd7bc69830280af19694ba18c7fb6fee9aee7c29d350`
- backup snapshot decrypts successfully with the fixture backup passphrase and vault passphrase

### 3. Generate export packet

Generated file:

- `proofvault-trust-case-specimen-full-2026-03-13T16-20-00-000Z.zip`

Observed files inside the ZIP:

- `attachments/door-notice.pdf`
- `case-summary.txt`
- `FINGERPRINT.txt`
- `ledger-audit.json`
- `manifest-2026-03-13T16-20-00-000Z.json`
- `metadata-appendix.md`
- `proof-vault-evidence.json`
- `timeline.md`
- `timeline.csv`

### 4. Cross-check the fingerprint

- open `FINGERPRINT.txt`
- record the manifest fingerprint and full manifest seal SHA-256
- store those values in the release fixture expectations

Observed values:

- manifest fingerprint: `C734-61F3-65B5-2AFA`
- manifest seal SHA-256: `c73461f365b52afaafbf9b0efc21c81339d356121b45b769f223c64f7671ae62`

### 5. Verify against the live vault

The repository fixture generator currently verifies against the backup snapshot rather than storing a separate live-vault report artifact. The expected live-vault outcome for the same unmodified specimen is the same terminal state:

- status `verified`
- `2` verified records
- `0` mismatches
- `0` missing records

### 6. Verify against the encrypted backup

- supply `proof-vault-evidence.json`
- supply `proofvault-backup-2026-03-13.pvault`
- enter the backup passphrase
- enter the vault passphrase
- run verification without importing records

Observed valid-run result:

- verification source: `backup-snapshot`
- report status: `verified`
- report checksum: `eb961ea9b3246d1010cf4b5aa8529a7af93e34bc703acc2839a12b94d06835f4`
- manifest seal valid: `true`
- record statuses: both records `verified`
- printable certificate artifact: `proofvault-verification-certificate.html`

### 7. Demonstrate modified or stale behavior

Observed tamper method:

- change the first evidence record `integrityRef` to a forged value
- rerun verification against the same encrypted backup snapshot

Observed tamper result:

- report status: `mismatch`
- report checksum: `43ecef38b411cf10195c97f08296bc50639651dd87ce2c719259c642c04a789e`
- manifest seal valid: `false`
- one record remains `verified`
- one record reports `Integrity reference does not match current vault state.`
- top-level issue: `Manifest integrity seal does not match the embedded evidence records.`

## Publication checklist

Before publishing the trust case:

1. Confirm that `demo/EXPECTED_OUTPUTS.json` still matches the generated specimen.
2. Confirm that `demo/SPECIMEN_BASELINE.md` still reflects the current pinned commit and runtime assumptions.
3. Confirm that the standalone verifier run uses the same case ID and record count as the export.
4. Include the valid and tampered verification reports together when publishing the release.
5. Update `KNOWN_LIMITATIONS.md` if the run exposed new drift or ambiguity.