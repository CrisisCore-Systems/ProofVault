# ProofVault Trust Case v1.0.1

## Subhead

A reproducible trust case for a local-first encrypted browser evidence app, with a pinned specimen, drift enforcement, and a public release tied to an exact hosted-green commit.

## Summary

ProofVault now carries part of its own proof burden in the repository. I built a trust dossier, a pinned specimen, automated regeneration and drift detection, and a hosted-CI-enforced release path that makes trust claims inspectable instead of aspirational.

## What I built

* bounded trust case and threat model
* pinned demo specimen with observed outputs
* verifier path showing valid and tampered behavior
* local and hosted-CI specimen regeneration
* drift detection that fails when trust-critical output changes
* public release tags preserving provenance across `v1.0` and `v1.0.1`

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
* hosted CI validates the final non-debug release tree
* `proofvault-trust-case-v1.0` remains immutable
* `proofvault-trust-case-v1.0.1` publishes the corrected hosted-stable release

## Impact line

Trust made legible, reproducible, and release-bound.

## CTA

* Read the case study
* Inspect the trust dossier
* Review the tagged release

## Shorter portfolio variant

**ProofVault Trust Case v1.0.1**

Built a reproducible trust case for a local-first encrypted browser evidence app, including a pinned specimen, verifier path, drift detection, and hosted-CI-enforced release integrity. Diagnosed and fixed cross-environment specimen drift at source instead of weakening the invariant. Final result: a public trust-case release tied to an exact hosted-green non-debug commit.

## CTA link copy

* **Case Study** — How the trust case was built and what it proved
* **Trust Dossier** — Bounded guarantees, threat model, walkthrough, and specimen
* **Release** — Public tagged trust-case cut with hosted-green provenance

## Suggested publish order

1. Portfolio case card
2. DEV article
3. Short announcement post linking both