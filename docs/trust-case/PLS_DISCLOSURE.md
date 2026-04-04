# PLS Disclosure

## Status

ProofVault does not currently publish a versioned, repository-local PLS rubric or threshold table.

Because of that, this file does not claim a formal tier certification. Any stronger claim would be rhetorical rather than structural.

## Current level claim

Claim withheld.

Current status is a provisional self-assessment only:

- ProofVault appears to satisfy substantial baseline Protective Legitimacy expectations around local authority, offline utility, recoverability, and truthful verification claims.
- ProofVault does not yet justify a named PLS tier because the tier definitions are not frozen in-repo.

## Hard-fail checks

The following would block any future tier claim until resolved:

- no versioned PLS thresholds exist in the repository
- the current release fixture is deterministic and checked in, but it is still anchored to one primary specimen ZIP even though the expectation file now records a broader release matrix
- browser-runtime compromise while unlocked remains outside the protection boundary
- no installable service-worker-backed offline runtime is currently evidenced in this repository

## Known deviations from an ideal protective system

- active session trust depends on the browser runtime remaining trustworthy while unlocked
- backup protection depends heavily on user-chosen passphrase quality
- key material and decrypted blobs cannot be guaranteed to leave memory promptly in the browser environment
- verification proves consistency against a snapshot, not public notarization or origin attestation
- no external transparency or timestamp authority is currently used

## Unresolved weaknesses that materially affect scoring

- session key lifecycle hardening remains limited by current in-memory handling
- browser-based redaction and decryption workflows have no strong memory cleanup guarantees
- reduced-disclosure export guarantees are materially stronger now, but the user can still intentionally choose a higher-disclosure mode
- fixture publication and release locking are process requirements, not yet automated controls

## What would be required to claim a tier

1. Publish a concrete PLS rubric with explicit pass and fail thresholds.
2. Freeze a release-specific trust-case fixture and include its expected outputs.
3. Add integration coverage for export generation, backup generation, staged restore promotion and rollback, standalone verification, and tamper detection.
4. Close the most important privacy and session-lifecycle deviations or scope them out explicitly in the rubric.
5. Re-score the build against that published rubric and record the failures as part of the release.

## Truthfulness rule

Until the rubric exists, this repository may claim:

- protective design intent
- local-first architecture
- encrypted backup and verification capability
- documented trust boundaries and known limitations

It should not claim:

- a formal PLS tier
- comprehensive anti-forensic protection
- resistance to a hostile unlocked device
