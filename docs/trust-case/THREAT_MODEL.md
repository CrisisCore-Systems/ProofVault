# Threat Model

## Purpose

This threat model is specific to ProofVault's current local-first architecture. It is not a generic application security checklist.

## Protected assets

- case records and narrative fields
- attached files and their integrity metadata
- encrypted payloads stored in the vault
- ledger entries linking case activity and exports
- encrypted backup files
- proof manifests, fingerprints, and verification reports

## Threat actors and conditions

- an attacker with temporary access to a shared device
- an attacker who obtains an exported ZIP or backup file
- a verifier who receives incomplete, stale, or tampered artifacts
- a stressed user making mistakes under time pressure
- a benign but unreliable environment: low battery, interrupted sessions, broken storage, or app closure

## Trust boundaries

| Boundary | What crosses it | Why it matters |
| --- | --- | --- |
| Browser session boundary | decrypted case data, attachments, session key access | The strongest protections only hold while the browser process remains trustworthy. |
| Export boundary | ZIP, manifest, fingerprint, optional metadata appendix, optional ledger audit | Once exported, privacy and retention are controlled by the recipient environment, not ProofVault. |
| Backup boundary | encrypted backup envelope plus backup passphrase | Backup portability is strong, but a weak or reused backup passphrase collapses that boundary. |
| Verification boundary | manifest JSON, encrypted backup, backup passphrase, vault passphrase | Verification is read-only, but trust still depends on receiving the correct inputs. |

## Architecture-specific threat scenarios

| Threat | Current handling | Residual risk |
| --- | --- | --- |
| Local device compromise while unlocked | Session lock and encrypted-at-rest storage reduce exposure before unlock. | If the attacker controls the device while unlocked, active session material and decrypted content are exposed. |
| Shared device exposure | Manual lock, idle timeout, and hidden-tab lock reduce accidental exposure. | User may forget to lock, or the device may be observed while in active use. |
| Backup corruption | Backup envelope stores a snapshot SHA-256 checked after decryption. | User still needs the correct backup and passphrase; corruption is detected, not repaired. |
| Backup theft with weak passphrase | Backup is separately encrypted from the vault. | Length-only minimum is not a strong entropy guarantee. User confusion between vault and backup passphrases remains a risk. |
| Metadata leakage in exports | Redaction policy can omit fields and attachments depending on mode. | Current export surface still risks leaking narrative or filename metadata when broader export settings are used. |
| Auth confusion | Standalone verification requires both backup and vault passphrases, making the trust model explicit. | Dual-passphrase flow can confuse users under stress and lead to unsafe reuse or storage practices. |
| Verification staleness | Verification compares the manifest against a live vault or backup snapshot and reports mismatch. | A once-valid manifest can become stale after edits; the system reports this but cannot prevent misuse of older artifacts. |
| Portability failure | Structured ZIP bundles preserve multiple human-readable and machine-readable artifacts. | Downstream tools may still mishandle ZIP contents, filenames, encodings, or PDFs. |
| User error under stress | Export previews and verification reports improve legibility. | Stress conditions can still produce wrong-case exports, oversharing, or skipped verification. |
| Redaction mismatch | Redacted image derivatives and omitted field claims are encoded into proof data. | Non-image files with redactions are omitted in redacted mode rather than transformed, which may surprise users. |

## Abuse cases

### Case 1: Modified evidence after export

Expected behavior:

- a previously generated manifest no longer matches the updated vault snapshot
- verifier reports record mismatch, not silent success

### Case 2: Wrong backup supplied to verifier

Expected behavior:

- case ID or evidence IDs fail to align with manifest claims
- verifier reports missing or mismatched records

### Case 3: User exports a full packet when intending a minimal packet

Expected behavior:

- exported files still match the selected policy and verify correctly
- privacy exposure still occurs because the broader packet left the device

This is a correctness success but a protective failure. The trust case therefore treats export choice clarity as a safety concern, not just a UX preference.

## Failure states that remain in scope

- verification completes with mismatch findings
- backup integrity check fails
- manifest JSON is malformed or duplicated
- record count in the manifest does not match embedded records
- attachment integrity becomes unverifiable because source files are missing

## Failure states outside the app's ability to solve

- malware inspecting process memory
- coerced disclosure of passphrases
- a recipient leaking exported materials after receipt
- hostile browser extensions or compromised runtime dependencies