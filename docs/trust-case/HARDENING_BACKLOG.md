# Hardening Backlog

This backlog turns the remaining trust-case gaps into named follow-up issues.

## Issue 1: Expand browser-level lock state coverage

Problem:
The Security route now covers restore and rollback paths directly, but lock-state transitions and related browser-state behavior still have thinner evidence.

Target:
Add route-level or browser-level tests for lock-on-hidden, manual lock, and post-restore relock expectations.

## Issue 2: Cover backup export failures in the UI

Problem:
Backup restore failure paths are covered more directly than backup export failures.

Target:
Add Security-route coverage for backup export validation and export failure messaging.

## Issue 3: Expand session, storage, and rotation coverage

Problem:
Session lifecycle, encrypted storage boundaries, and passphrase rotation still have less direct coverage than the export and restore paths.

Target:
Add targeted tests for session invalidation, storage edge cases, and rotation success and failure behavior.

## Issue 4: Publish project-specific PLS thresholds

Problem:
The repo still carries a provisional PLS disclosure rather than an explicit project-local rubric with pass and fail thresholds.

Target:
Publish a versioned PLS scoring document and tie future release reviews to it.

## Issue 5: Strengthen provenance later

Problem:
The trust case is release-bound and reproducible, but it still relies on local and CI process evidence rather than stronger external anchoring.

Target:
Explore signed fixture publication, stronger release attestation, or external transparency anchoring in a later cycle.
