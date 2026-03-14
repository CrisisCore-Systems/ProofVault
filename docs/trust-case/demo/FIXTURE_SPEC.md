# Fixture Spec

## Required generated files

The release fixture should contain the following generated artifacts:

| File | Purpose |
| --- | --- |
| `proofvault-trust-case-specimen-full-2026-03-13T16-20-00-000Z.zip` | Public export packet under review |
| `proofvault-backup-2026-03-13.pvault` | Encrypted backup used by the standalone verifier |
| `proof-vault-evidence.json` | Proof manifest extracted from the export or stored alongside it |
| `proofvault-verification-report.json` | Machine-readable verification report for the valid run |
| `proofvault-verification-report-tampered.json` | Machine-readable verification report for the tamper run |
| `proofvault-verification-certificate.html` | Human-readable print-ready certificate output |
| `FINGERPRINT.txt` | Frozen fingerprint values for manual and machine cross-check |
| `EXPECTED_OUTPUTS.json` | Release-specific counts, checksums, and expected statuses |

## Required recorded values

- case title
- case ID
- export timestamp
- manifest integrity seal
- short manifest fingerprint
- verification report SHA-256
- backup snapshot SHA-256
- expected record count
- expected verification status for the valid run
- expected verification status for the tamper run

## Minimum release checks

1. The valid manifest verifies against the live vault.
2. The valid manifest verifies against the encrypted backup.
3. The tampered or stale manifest reports mismatch.
4. The case ID, record count, and export timestamp line up across manifest, report, and fixture expectations.
5. The fingerprint file and the expectation file agree on the manifest seal.