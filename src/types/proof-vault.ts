import type { EncryptedPayload, EvidenceItem, ExportBundle } from "../domain/types";

export type ProofVaultExportFormat = "zip" | "pdf" | "csv";

export type ProofVaultSourceField =
  | "attachment"
  | "description"
  | "encryptedPayload"
  | "locationText"
  | "occurredAt"
  | "originalFilename"
  | "peopleInvolved"
  | "redactions"
  | "sha256"
  | "tags";

export type ProofVaultRedactionPolicy = {
  id: "full" | "minimal";
  mode: ExportBundle["mode"];
  label: string;
  omittedFields: ProofVaultSourceField[];
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
};

export type ProofVaultProvenance = {
  integrityRef: string;
  encryptedPayloadRef: string | null;
  sourceSnapshotRef: string;
  attachmentRef: string | null;
};

export type ProofVaultExportContext = {
  redactionPolicy: ProofVaultRedactionPolicy;
  exportTimestamp: string;
  outputFormat: ProofVaultExportFormat;
};

export type ProofVaultEvidenceRecord = {
  sourceId: string;
  provenance: ProofVaultProvenance;
  exportContext: ProofVaultExportContext;
  omittedFields: ProofVaultSourceField[];
  integritySeal: string;
};

export type ProofVaultEvidenceManifest = {
  schemaVersion: 1;
  caseId: string;
  exportedAt: string;
  outputFormat: ProofVaultExportFormat;
  recordCount: number;
  evidenceRecords: ProofVaultEvidenceRecord[];
  integritySeal: string;
};

export type ProofVaultSourceSnapshot = Pick<
  EvidenceItem,
  | "id"
  | "title"
  | "kind"
  | "description"
  | "occurredAt"
  | "recordedAt"
  | "locationText"
  | "peopleInvolved"
  | "tags"
  | "fileRef"
  | "originalFilename"
  | "mimeType"
  | "sha256"
  | "redactions"
  | "includeInExport"
  | "redactionStatus"
  | "dateCertainty"
  | "createdAt"
  | "updatedAt"
> & {
  encryptedPayload?: EncryptedPayload;
};