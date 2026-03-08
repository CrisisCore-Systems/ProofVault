# ProofVault v0.1 Screen Map

This map defines the v0.1 UX shape and navigation boundaries.

## Top-level navigation

1. Inbox
2. Cases
3. Timeline
4. Exports

No additional top-level tabs in v0.1.

## Global action cluster (home)

Primary actions surfaced prominently:

- New Incident
- Add Attachment
- Record Audio Note
- Open Active Case

Supporting blocks:

- recent captures
- unresolved items
- cases needing assembly
- last export

## Screen 1: Quick Capture

Purpose: record an incident in under 30 seconds.

Required fields:

- What happened?
- When?
- Where?
- Who was involved?
- Notes
- Attach now or later

Rules:

- opens immediately
- single dominant Save action
- minimal visual clutter

## Screen 2: Case Detail

Shows:

- case title
- case type
- status
- timeline items
- evidence count
- missing pieces
- export action

Primary flows:

- assign unlinked evidence to case
- review chronology completeness
- launch export builder

## Screen 3: Item Detail

Shows:

- preview
- notes
- tags
- date certainty
- source metadata
- integrity hash
- linked case
- redact/include flags

Primary flows:

- adjust export inclusion
- set redaction status
- refine metadata for later export legibility

## Screen 4: Timeline

Purpose: cross-case chronological evidence stream.

Filters required in v0.1:

- by case
- by category
- by person
- by date range
- flagged or unreviewed

View behavior:

- strict chronological ordering
- clear type labeling (incident, attachment, note, contact)

## Screen 5: Export Builder

Required choices:

- case
- date range
- full vs redacted mode
- include attachments
- include metadata appendix
- output format (ZIP in v0.1)

Output artifact baseline:

- manifest.json
- timeline.csv
- timeline.md
- attachments/
- case-summary.txt

## Navigation flows

Primary happy path:

1. Quick Capture creates EvidenceItem
2. Item lands in Inbox and Timeline
3. User assigns item to Case
4. User reviews case chronology in Timeline
5. User builds ZIP export from Exports

Secondary path (attachment-first):

1. Add Attachment
2. hash and metadata recorded
3. assign to case now or later
4. include/exclude or redact in Item Detail

## Out of scope in v0.1

- cloud sync screens
- collaboration and sharing views
- OCR review screens
- AI summary and recommendation views
- court filing integrations

## UX principles enforcement checklist

- capture under stress
- local authority
- safe degradation
- bounded reversibility
- exposure minimization
- legibility under pressure
