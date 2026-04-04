# ProofVault Trust Case v1.1.0

## Release summary

This release freezes the current hardening pass into a new trust-case-bound public cut.

It carries four important facts into the public proof surface:

- export modes are `minimal`, `redacted`, and `full`
- attachments are protected at rest through the live encryption and persistence path
- restore is staged before promotion and captures rollback snapshots automatically
- the runtime boundary remains a plain browser app, not a hardened PWA claim

## What changed since the earlier trust-case cuts

- stale evidence references in the trust case were corrected to point at the crypto and storage modules that actually exist
- the root README and trust dossier now match the shipped export, attachment, and restore behavior more closely
- direct restore and rollback coverage now exists at both the module and Security-route level
- the trust dossier now includes a delta audit showing what a hard recrawl found and how the repo was corrected

## Public claims this release supports

- local-first encrypted browser app
- release-bound trust case
- protected attachments at rest
- staged restore with rollback
- external verification against backup snapshot

## Claims this release still does not support

- hardened PWA
- anti-forensic protection
- safety against a hostile unlocked device
- formal PLS tier

## Verification and release gate

The trust-case specimen for this release is regenerated and checked through the pinned fixture workflow and the local `npm run check:trust-case` gate.

## Next hardening targets

- browser-level lock state coverage
- backup export failure coverage
- session, storage, and rotation coverage expansion
- published PLS thresholds
- provenance strengthening in a later cycle
