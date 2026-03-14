# Specimen Baseline

- Release: ProofVault Trust Case v1.0
- Git ref: bd968e91a1fd58384b2af2eb389402728c9980f3
- Generated at: 2026-03-13T16:20:00.000Z
- Node runtime: v22.19.0
- Browser/runtime assumptions: Web Crypto, Blob, File, and JSON ZIP handling are available and behave consistently with the current build.
- Environment sensitivity: export filenames, proof manifests, backup envelopes, archive entry metadata, and checksums are pinned by a fixed Date shim plus deterministic random bytes in the generator harness.
