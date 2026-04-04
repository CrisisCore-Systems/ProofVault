# ProofVault Trust Case v1.1.0

## Subhead

A release-bound trust case for a local-first encrypted browser evidence app, with a pinned specimen, drift enforcement, explicit claim discipline, and a public release that reflects the latest hardening pass.

## Summary

ProofVault now carries part of its own proof burden in the repository. The trust dossier, pinned specimen, automated regeneration, drift detection, and hosted-CI release path are now paired with stronger real protections: protected attachments at rest, serializer-enforced minimal or redacted exports, staged restore with rollback, and external verification against backup snapshots.

## What I built

* bounded trust case and threat model
* pinned demo specimen with observed outputs
* verifier path showing valid and tampered behavior
* local and hosted-CI specimen regeneration
* drift detection that fails when trust-critical output changes
* public release tags preserving provenance across `v1.0`, `v1.0.1`, and `v1.1.0`
* route-level and module-level coverage for staged restore and rollback behavior

## What made this hard

* local success was not enough
* GitHub’s hosted runner exposed cross-environment drift that did not appear on the initial local path
* the specimen had to be stabilized without weakening the invariant

## What I fixed

* host-local timestamp rendering
* archive metadata drift across environments
* pinned specimen metadata incorrectly stamping the live Node patch version

## Outcome

* trust specimen is reproducible and release-bound
* hosted CI validates the current release tree
* `proofvault-trust-case-v1.0` and `proofvault-trust-case-v1.0.1` remain immutable historical cuts
* `proofvault-trust-case-v1.1.0` publishes the current hardening pass with corrected trust evidence references and stronger restore coverage

## Impact line

Trust made legible, reproducible, and release-bound.

## CTA

* Read the case study
* Inspect the trust dossier
* Review the tagged release

## Shorter portfolio variant

Built a release-bound trust case for a local-first encrypted browser evidence app, including a pinned specimen, verifier path, drift detection, protected attachments at rest, staged restore with rollback, and hosted-CI-enforced release integrity. The public dossier now carries its own delta audit, showing where hard review found seams and how those seams were fixed.

## CTA link copy

* **Case Study** — How the trust case was built and what it proved
* **Trust Dossier** — Bounded guarantees, threat model, walkthrough, and specimen
* **Release** — Public tagged trust-case cut with hosted-green provenance

## Suggested publish order

1. Portfolio case card
2. DEV article
3. Short announcement post linking both
