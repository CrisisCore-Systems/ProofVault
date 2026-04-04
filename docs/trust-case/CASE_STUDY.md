# ProofVault Trust Case Case Study

**ProofVault Trust Case v1.0.1** is not a marketing claim about trust. It is a worked example of how to make trust legible, reproducible, and release-bound.

Many projects say they care about security, privacy, or integrity. Far fewer can point to a concrete specimen, regenerate it from the repository, detect drift automatically, show what tampering looks like, and identify the exact hosted-green release tree tied to a public tag.

ProofVault now does.

This case study explains what was built, why it matters, and what the release process actually proved.

## The problem

ProofVault is a local-first encrypted browser application built for unstable, privacy-sensitive, and high-stress conditions. A system like that carries a higher burden than ordinary product software.

It is not enough to say:

* the app encrypts data
* the app exports records
* the app has verification features

Those claims stay abstract unless they are tied to a concrete proof surface.

The trust-case work addressed that gap directly. The goal was to build a public artifact that answers, in checkable form:

* what ProofVault currently guarantees
* what it explicitly does not guarantee
* what evidence supports those claims
* how a third party can reproduce and inspect trust-critical output
* how release integrity is preserved when the environment changes

## What was built

The result is a trust dossier under `docs/trust-case/` and a pinned specimen under `docs/trust-case/demo/`.

That package includes:

* a bounded trust case with guarantees, trust boundaries, and non-guarantees
* an explicit threat model and limitation set
* a verification walkthrough grounded in a real specimen
* a frozen demo case with pinned observed outputs
* automated regeneration and drift detection
* a CI workflow that enforces the specimen on GitHub’s hosted runner

The important point is not that each of these pieces exists individually. The important point is that they are connected.

The repository can now say:

* here is the specimen
* here is how it is regenerated
* here is what counts as expected output
* here is what happens if the output changes
* here is the exact release tree that passed hosted CI
* here is the public tag tied to that proof

That is a different class of credibility than a documentation page or a sentence in a README.

## The specimen changed the conversation

The pinned specimen made the trust case concrete.

Instead of talking about integrity in the abstract, the trust case now includes a real export, real proof manifest, real verification reports, real fingerprint data, and a real tampered case showing mismatch behavior.

That shifts the burden of trust in an important way.

The project no longer asks a reader to assume that the export path, manifest sealing, backup verification, and release process all fit together. It shows one exact instance of those things fitting together, and it gives the repository a way to notice when that example stops matching reality.

## Drift detection is the enforcement mechanism

A trust case without drift detection decays quickly.

Once a specimen is checked in, the risk is obvious: future changes can silently alter trust-critical output while the documentation continues to describe old behavior. That is how trust language collapses into theater.

ProofVault avoids that by treating the specimen as a checked invariant.

The local gate and the GitHub Actions workflow regenerate the specimen and compare it against the pinned outputs. If the trust-critical surface changes, the build fails until the change is explicitly reviewed and the specimen is intentionally updated.

That matters because it binds trust claims to maintenance discipline. The trust case is not merely published once. It is kept under pressure.

## Hosted CI mattered more than local success

One of the most important parts of this work happened after the local system already looked correct.

The specimen was green on Windows. It was green under `TZ=UTC`. It was green in a Linux clone under WSL. But GitHub’s hosted runner still failed.

That was the decisive moment.

At that point, the responsible move was not to weaken the check, normalize away the problem, or assume CI was flaky. The responsible move was to treat the hosted runner as part of the real release surface and keep digging until the mismatch had a concrete explanation.

That investigation surfaced three environment-sensitive faults in the specimen generation path:

* timestamp rendering that depended on host-local presentation
* archive metadata that drifted across environments
* pinned specimen metadata that incorrectly stamped the live Node patch version

Each of those faults was fixed at source. The check stayed strict.

Temporary CI diagnostics were added only long enough to expose the hosted-runner disagreement, then removed before the final release tag was cut.

That sequence matters as much as the fixes themselves. It shows that the release process was not green by accident. It was made legible under the same hosted surface the public repository actually depends on.

## Why v1.0 and v1.0.1 both matter

The release history is part of the trust case.

`proofvault-trust-case-v1.0` remains the first public trust-case cut. It was not moved or rewritten after publication.

`proofvault-trust-case-v1.0.1` exists because the project found and corrected real cross-environment specimen drift, proved the fixes on hosted CI, removed temporary diagnostics, and tagged the final non-debug tree.

That preserves something important: provenance.

Instead of silently rewriting the first tag, the project kept the original public cut intact and published a corrected release with a clear explanation of what changed. That is stronger than pretending the first release had been universally stable all along.

## What this proves

This work does not prove that ProofVault solves every security or legitimacy problem.

It does prove that the project can:

* define a bounded trust model
* connect that model to code and generated artifacts
* make tampering visible through a verifier path
* detect cross-environment drift in trust-critical output
* fix release-surface mismatches without weakening the invariant
* publish a public tag tied to an exact hosted-green tree

That is the core of the case study.

ProofVault is no longer asking for trust on the strength of intent alone. It is carrying part of its own proof burden in the repository.

## Why this matters beyond one project

This pattern is reusable.

Any system that makes claims about privacy, integrity, recoverability, or verification can benefit from the same discipline:

* define the bounded claim surface
* publish one reproducible specimen
* encode expected outputs
* treat drift as a first-class failure
* require the real release surface to pass, not just a local machine

For ProofVault, that makes the trust case a credibility pillar. For Protective Computing more broadly, it provides a reference specimen for what doctrine looks like when it is translated into architecture, tests, CI, and release hygiene.

## Final release state

The corrected public trust-case release is:

* tag: `proofvault-trust-case-v1.0.1`
* final hosted-green non-debug release commit: `dc5fbe9`

The original public cut remains:

* tag: `proofvault-trust-case-v1.0`

That is the final shape of the case study: not a statement of values, but a system that can show its work.