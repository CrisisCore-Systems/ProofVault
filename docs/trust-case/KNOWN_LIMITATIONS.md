# Known Limitations

## Current limitations

### Unlocked-device compromise remains fatal

ProofVault protects local data primarily before unlock and after lock. It does not claim to withstand an attacker who already controls the device or browser process while the vault is open.

### Session and memory hygiene are constrained by the browser

Session keys, decrypted attachments, and redaction intermediates exist in browser memory during active use. The current implementation cannot guarantee prompt zeroization or reliable post-use memory eviction.

### Backup usability and backup security pull against each other

Backups are separately encrypted, which is good for compartmentalization, but the dual-passphrase model still increases user confusion risk. The current passphrase policy is materially stronger than a length-only check, but backup safety still depends on the user choosing and retaining a distinct high-entropy backup passphrase.

### Export privacy depends on correct mode selection

The export flow now enforces serializer-layer disclosure policies for `full`, `redacted`, and `minimal` modes. Residual privacy risk still depends on the user selecting the intended mode before the ZIP leaves the device.

### Metadata minimization still needs hardening

Filename and attachment-hash stripping are now enforced for reduced-disclosure exports, and minimal mode disables attachments and appendix metadata entirely. The remaining conservative boundary is that browser-side narrative handling and user mode selection still determine how much context is intentionally disclosed.

### Verification proves consistency, not universal truth

Proof verification can detect tampering, missing records, and stale exports relative to a supplied snapshot. It does not prove who originally created the evidence, whether the source device was trustworthy, or whether the evidence is complete.

### Test coverage is incomplete in security-critical paths

There is targeted coverage for proof manifests, verification reporting, export privacy policy, attachment encryption, backup attachment serialization, staged restore plus rollback mechanics, and Security-route restore and rollback states. Coverage is still thinner across the broader browser-runtime boundary than at the module boundary.

## Open hardening priorities

### Now

- publish the updated trust posture without understating current protections
- add browser-level integration coverage beyond the current restore and rollback path coverage, especially lock state changes and backup export failures
- keep fixture and trust-dossier claims aligned as serializer and restore behavior evolve

### Next

- publish project-local PLS thresholds
- reduce user confusion between vault and backup credentials in the UI and fixture walkthrough
- expand direct test coverage for session, storage, and rotation paths

### Later

- explore stronger provenance anchoring for published fixtures
- investigate safer lifecycle handling for decrypted blobs and redaction intermediates

## Claim discipline

If a future feature improves one of these areas, update this file only when the improvement is implemented, tested, and reflected in the generated fixture artifacts.
