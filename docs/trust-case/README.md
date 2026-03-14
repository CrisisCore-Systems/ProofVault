# ProofVault Trust Case v1.0

This package is the public trust dossier for ProofVault as it exists today.

It is not a product vision deck and it is not a security marketing page. It is a bounded, reproducible account of what the system currently claims, what evidence supports those claims, where the trust boundaries sit, and which risks remain open.

## Contents

- [TRUST_CASE.md](./TRUST_CASE.md): system guarantees, trust boundaries, assumptions, and defensibility packet.
- [THREAT_MODEL.md](./THREAT_MODEL.md): architecture-specific threats, abuse cases, and failure states.
- [PLS_DISCLOSURE.md](./PLS_DISCLOSURE.md): self-assessment against Protective Legitimacy expectations, including withheld claims.
- [VERIFICATION_WALKTHROUGH.md](./VERIFICATION_WALKTHROUGH.md): end-to-end export and verification procedure.
- [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md): current weaknesses, coverage gaps, and risks that still require hardening.
- [demo/README.md](./demo/README.md): reproducibility fixture pack contract.
- [demo/FIXTURE_SPEC.md](./demo/FIXTURE_SPEC.md): frozen fixture layout and release checklist.
- [demo/EXPECTED_OUTPUTS.json](./demo/EXPECTED_OUTPUTS.json): observed filenames, checksums, and valid versus tampered verification results for the current specimen.
- [demo/SPECIMEN_BASELINE.md](./demo/SPECIMEN_BASELINE.md): pinned commit and runtime assumptions for the generated fixture.
- [demo/EXPECTED_OUTPUTS.template.json](./demo/EXPECTED_OUTPUTS.template.json): machine-readable template for checksums and expected outputs.

## Current specimen

The current repo includes a generated specimen under `docs/trust-case/demo/` for case `case-trust-2026-001` (`Trust Case Specimen`).

The observed release values are recorded in:

- `demo/EXPECTED_OUTPUTS.json`
- `demo/CASE_NOTES.md`
- `demo/SPECIMEN_BASELINE.md`

## Continuous validation

The specimen is revalidated by:

- the local `npm run check:trust-case` command
- the CI workflow in `.github/workflows/trust-case.yml`

The gate regenerates the specimen, compares the checked-in files under `docs/trust-case/demo/`, and fails if drift appears without an explicit fixture update.

## Release stance

This dossier should ship with a named release, not drift continuously with feature work.

Recommended release label:

`ProofVault Trust Case v1.0`

Recommended publication gate:

1. Freeze the build under review.
2. Generate the demo fixture from that exact build.
3. Compare the generated fixture against `demo/EXPECTED_OUTPUTS.json`, and update both that file and the template if the specimen changes.
4. Verify every claim in this package against the generated fixture.
5. Publish the package and link it from the repo root.