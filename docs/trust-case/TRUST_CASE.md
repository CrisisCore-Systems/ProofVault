# Trust Case

## Scope

ProofVault is a local-first encrypted browser application intended for unstable, high-stress, and privacy-sensitive conditions.

This trust case is limited to the behavior implemented in the current repository. It does not claim protections that depend on future infrastructure, external attestations, or unpublished hardening work.

## System guarantees

| Area | Current guarantee | Evidence source | Boundary / caveat |
| --- | --- | --- | --- |
| Local authority | Core capture, review, export, and verification workflows run locally in-browser without a required account or network dependency. | `README.md`, `src/app/routes/Security.tsx`, `src/app/routes/StandaloneVerifier.tsx` | Browser and device integrity are assumed while the vault is unlocked. |
| Storage confidentiality | Sensitive vault content and protected attachments are encrypted at rest using Web Crypto based key derivation and AES-GCM wrappers before persistence. | `src/features/security/crypto.ts`, `src/features/security/storage.ts`, `src/features/vault/attachmentCrypto.ts`, `src/db/queries.ts` | Does not protect against an attacker who already controls the unlocked device or browser process. |
| Export integrity | Export packets include a proof manifest, manifest seal, and root fingerprint file for human cross-check. | `src/lib/export/exportBundle.ts`, `src/lib/export/proofVault.ts`, `src/lib/export/integrityFingerprints.ts` | Integrity proves consistency against the checked snapshot, not legal authenticity or origin beyond the local vault state. |
| Append-only audit trail | Export generation and case events can be linked to a hash-chained ledger. | `src/features/ledger/chain.ts` | This is a local append-only chain, not an external transparency log. |
| External verification | A proof manifest can be verified against either the live vault state or an encrypted backup snapshot without importing records into the verifier database. | `src/features/exports/useExportBuilder.ts`, `src/app/routes/StandaloneVerifier.tsx`, `src/features/security/backup.ts`, `src/lib/export/proofVerifier.ts` | Verifier trust still depends on the supplied manifest, backup, passphrases, and browser execution environment. |
| Portability | Case exports produce a structured ZIP with manifest, timeline, summary, fingerprint, and proof data. | `src/lib/export/exportBundle.ts` | Portability is limited to the package formats currently emitted by the app. No court-system or third-party import guarantees are claimed. |
| Recoverability | Encrypted backups can be created, previewed, and restored locally. | `src/features/security/backup.ts`, `src/app/routes/Security.tsx` | Recovery depends on retaining both the backup file and the correct passphrases. |

## Explicit non-guarantees

ProofVault does not currently claim:

- protection from full device compromise while the vault is unlocked
- resistance to browser memory inspection or post-decryption memory scraping
- external timestamp notarization or public transparency logging
- collaborative chain-of-custody across multiple devices or operators
- forensic-grade authenticity of original capture hardware
- complete metadata elimination from every export mode
- formally versioned PLS tier certification

## Trust boundaries

### Inside scope

- local IndexedDB persistence
- local vault encryption and session controls
- encrypted backup creation and restore preview
- local export packet construction
- proof manifest generation and verification
- human-readable fingerprint cross-checks

### Outside scope

- the integrity of the host operating system
- malware or remote-control compromise of the browser session
- physical coercion against the user
- unsafe passphrase handling outside the app
- downstream handling of exported ZIPs, PDFs, or screenshots by third parties

## Operational assumptions

This trust case assumes:

- the user still controls the device at the time of capture, export, and verification
- the vault passphrase and backup passphrase are not disclosed to an attacker
- the user preserves the encrypted backup needed for external verification
- the verifier receives the same manifest and backup pair that the exporter intended to share
- the current app build has not been modified between the documented fixture run and publication

## Defensibility packet

### Integrity model

- Each proof record derives integrity references from the evidence snapshot, encrypted payload reference, and attachment hash.
- The manifest integrity seal is computed over a canonicalized record set and shared export context.
- Verification recomputes expected record values from the supplied vault snapshot and reports mismatches record by record.

### Portability model

- ZIP exports contain a machine-readable manifest, timeline views, case summary, proof manifest, and fingerprint file.
- Optional metadata appendix and ledger audit files can be included when metadata is intentionally retained.
- The package is intended to remain legible without reopening the original app.

### Recoverability stance

- ProofVault favors local encrypted backup over service-dependent sync.
- Restore preview exposes conflicts before import, and live restore promotion is staged plus rollback-backed by default.
- Recovery is only as strong as passphrase retention and backup hygiene.

### Abuse and failure boundaries

- If the device is already hostile, ProofVault cannot restore trust through local crypto alone.
- If the wrong backup or manifest is supplied, verification may fail or report mismatch.
- If a user exports with broader metadata than intended, privacy exposure leaves the device with the export artifact.

### Now / Next / Later

Now:
- Freeze and publish a reproducible trust-case fixture from the current build.
- Document exact guarantees and withheld claims.
- Treat verifier outputs and fingerprint cross-checks as the public proof surface.

Next:
- Add broader integration coverage for export-to-verify-to-backup flows beyond the current restore and rollback UI paths.
- Publish project-specific PLS thresholds instead of relying on a provisional disclosure.
- Keep export privacy guarantees and trust-dossier evidence references aligned as code evolves.

Later:
- Add stronger provenance options, such as explicit fixture signing or external transparency anchoring.
- Improve key lifecycle handling and memory-sensitive cleanup where browser constraints allow.

## Publication rule

Every claim in this file should map to one of:

- repository code
- an automated test
- a generated demo artifact in `docs/trust-case/demo/`
- an explicit limitation recorded in this package