# ProofVault

ProofVault is an offline-first encrypted evidence and incident capture app for people documenting disputes, harm, or institutional conflict under unstable conditions.

## Product stance

ProofVault is a protective field instrument.

It is designed for collapse conditions where users may be stressed, rushed, offline, unsafe, or cognitively overloaded.

Core outcomes:
- capture what happened fast
- preserve files locally
- structure evidence into a case
- export a clean packet later

## v0.1 scope

Version 0.1 includes only these six capabilities:

1. Quick incident capture
	- title
	- date and time
	- location
	- people involved
	- category
	- freeform note
	- urgency flag

2. Attachment intake
	- photos
	- screenshots
	- PDFs
	- audio notes
	- text entries

3. Case grouping
	- assign evidence to case files

4. Integrity metadata
	- created timestamp
	- imported timestamp
	- source type
	- local content hash
	- optional original filename
	- optional file metadata snapshot

5. Timeline view
	- date-ordered entries
	- filters for incident, attachment, note, contact, export-ready, needs review

6. Export packet
	- clean bundle with case summary, indexed timeline, evidence manifest, attachment references
	- redacted or full export mode

## Non-goals for v0.1

Do not build these in v0.1:
- cloud sync
- collaboration
- OCR
- AI summarization
- court filing integrations
- e-signatures
- blockchain features
- analytics dashboards

## Primary navigation

Top-level tabs:
- Inbox
- Cases
- Timeline
- Exports

## Architecture baseline

- Frontend: React + TypeScript + Tailwind
- Local data: Dexie over IndexedDB
- Validation: Zod
- Crypto: Web Crypto API
- Packaging: JSZip
- Dates: date-fns

## Security baseline

- Local-first storage (no required account)
- No telemetry in v0.1
- Two-tier protection model:
  - Tier 1: app/session lock
  - Tier 2: encrypted sensitive payloads at rest
- SHA-256 hash stored for imported attachments

## Export outputs (v0.1)

1. Structured ZIP packet
	- manifest.json
	- timeline.csv
	- timeline.md
	- attachments/
	- case-summary.txt

2. Printable packet
	- deferred
	- not required for day-one release

## Build artifacts locked now

- Data schema: docs/data-schema.md
- Screen map: docs/screen-map.md

## Build order

1. Skeleton (shell, navigation, DB, types)
2. Capture (quick form, save notes, recent list)
3. Attachments (import, hash, metadata)
4. Cases (create, assign, detail)
5. Timeline (chronological view, filters, item detail)
6. Export (manifest, ZIP, redacted/full)

## Seven-day sprint guide

- Day 1: scaffold app, routes, types, DB schema
- Day 2: quick capture and recent items
- Day 3: attachment import and hashing
- Day 4: case creation and linking
- Day 5: timeline and item detail
- Day 6: ZIP export + manifest
- Day 7: disclosure, conformance matrix, README polish, screenshots

## Initial repo target

The app should evolve toward this structure:

proofvault/
  app/
	 routes/
	 screens/
	 components/
	 features/
		capture/
		cases/
		timeline/
		exports/
		security/
  lib/
	 db/
	 crypto/
	 hashing/
	 export/
	 utils/
  public/
  docs/
  tests/

## Launch narrative

Most evidence systems assume people document harm from stable conditions.
ProofVault is for when those conditions fail.

## Trust Case

ProofVault now includes a public trust dossier scaffold under [docs/trust-case/README.md](./docs/trust-case/README.md).

The package is intended to become a named release artifact, not a drifting notes folder. It binds together:

- system guarantees and non-guarantees
- architecture-specific threat boundaries
- a provisional PLS disclosure with withheld claims called out explicitly
- an end-to-end verification walkthrough
- known limitations and hardening priorities
- a reproducibility fixture contract for exported proof artifacts

Recommended publication label:

`ProofVault Trust Case v1.0`

The frozen specimen is continuously revalidated in CI through `.github/workflows/trust-case.yml` and the local `npm run check:trust-case` gate.