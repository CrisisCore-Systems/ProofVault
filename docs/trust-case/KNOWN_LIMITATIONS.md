# Known Limitations

## Current limitations

### Unlocked-device compromise remains fatal

ProofVault protects local data primarily before unlock and after lock. It does not claim to withstand an attacker who already controls the device or browser process while the vault is open.

### Session and memory hygiene are constrained by the browser

Session keys, decrypted attachments, and redaction intermediates exist in browser memory during active use. The current implementation cannot guarantee prompt zeroization or reliable post-use memory eviction.

### Backup usability and backup security pull against each other

Backups are separately encrypted, which is good for compartmentalization, but the dual-passphrase model increases user confusion risk. The minimum backup passphrase check is length-based and does not ensure strong entropy.

### Export privacy depends on correct mode selection

The export flow supports reduced-disclosure modes, but privacy still depends on the user selecting the intended export options before the ZIP leaves the device.

### Metadata minimization still needs hardening

The current trust posture should be conservative about filename, narrative, and appendix leakage. Where policy claims and actual export behavior could drift, the trust case should defer to the more conservative interpretation until stronger enforcement is added.

### Verification proves consistency, not universal truth

Proof verification can detect tampering, missing records, and stale exports relative to a supplied snapshot. It does not prove who originally created the evidence, whether the source device was trustworthy, or whether the evidence is complete.

### Test coverage is incomplete in security-critical paths

There is targeted coverage for proof manifests, verification reporting, and export artifacts, but major security-sensitive modules still lack direct tests or end-to-end integration coverage.

## Open hardening priorities

### Now

- generate and freeze a public reproducibility fixture
- add integration coverage across export, backup, and standalone verification
- tighten export field omission so privacy guarantees are enforced at construction time

### Next

- publish project-local PLS thresholds
- improve passphrase guidance and reduce confusion between vault and backup credentials
- expand direct test coverage for backup, session, storage, and rotation paths

### Later

- explore stronger provenance anchoring for published fixtures
- investigate safer lifecycle handling for decrypted blobs and redaction intermediates

## Claim discipline

If a future feature improves one of these areas, update this file only when the improvement is implemented, tested, and reflected in the generated fixture artifacts.