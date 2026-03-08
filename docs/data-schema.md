# ProofVault v0.1 Data Schema

This document defines the canonical v0.1 data model for local-first evidence capture.

## Design constraints

- durable and auditable
- simple to serialize and export
- explicit integrity fields
- explicit redaction and export controls
- no cloud-required assumptions

## Type: CaseFile

```ts
type CaseFile = {
  id: string
  title: string
  type: "housing" | "work" | "legal" | "medical" | "family" | "other"
  description?: string
  status: "active" | "archived" | "draft"
  createdAt: string
  updatedAt: string
}
```

### Notes

- `id`: stable unique identifier (UUID recommended)
- `status`: defaults to `draft` on creation, transitions to `active`
- timestamps should be ISO 8601 in UTC

## Type: EvidenceItem

```ts
type EvidenceItem = {
  id: string
  caseId?: string
  kind: "incident" | "photo" | "screenshot" | "pdf" | "audio" | "note"
  title: string
  description?: string
  occurredAt?: string
  recordedAt: string
  importedAt?: string
  locationText?: string
  peopleInvolved?: string[]
  tags?: string[]
  fileRef?: string
  originalFilename?: string
  mimeType?: string
  sha256?: string
  includeInExport: boolean
  redactionStatus: "none" | "partial" | "full"
  dateCertainty: "exact" | "approximate" | "unknown"
  createdAt: string
  updatedAt: string
}
```

### Notes

- `recordedAt` is mandatory: when user captured item in app
- `occurredAt` is optional: event time can be unknown under stress
- `importedAt` should be set for externally sourced files
- `sha256` is required for imported attachments when hashing succeeds
- `includeInExport` defaults to `true`
- `redactionStatus` defaults to `none`
- `dateCertainty` defaults to `unknown` unless user confirms

## Type: ExportBundle

```ts
type ExportBundle = {
  id: string
  caseId: string
  mode: "full" | "redacted"
  createdAt: string
  itemIds: string[]
  manifestRef: string
  archiveRef?: string
}
```

### Notes

- `manifestRef` points to generated `manifest.json`
- `archiveRef` points to final ZIP artifact when generated

## Storage mapping (v0.1)

Suggested Dexie tables:

- `cases`
  - key: `id`
  - indexes: `status`, `type`, `updatedAt`

- `evidenceItems`
  - key: `id`
  - indexes: `caseId`, `kind`, `recordedAt`, `occurredAt`, `includeInExport`, `updatedAt`

- `exports`
  - key: `id`
  - indexes: `caseId`, `mode`, `createdAt`

## Integrity and crypto fields

- Compute SHA-256 for imported binary attachments
- Keep hash value immutable after initial compute
- Store encrypted payload segments for sensitive text fields as architecture matures
- Preserve original filename and MIME type when available

## Validation baseline (Zod direction)

- enforce non-empty `title` for `CaseFile` and `EvidenceItem`
- enforce enum values exactly as defined above
- enforce ISO 8601 timestamp format for all time fields
- enforce that `itemIds` in `ExportBundle` are non-empty for finalized exports

## Migration posture

- all schema additions must be additive in v0.x
- avoid destructive field renames during v0.1
- record schema version in manifest exports
