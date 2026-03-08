export type CaseFile = {
  id: string;
  title: string;
  type: "housing" | "work" | "legal" | "medical" | "family" | "other";
  description?: string;
  status: "active" | "archived" | "draft";
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RedactionRegion = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EvidenceItem = {
  id: string;
  caseId?: string;
  kind: "incident" | "photo" | "screenshot" | "pdf" | "audio" | "note";
  title: string;
  description?: string;
  occurredAt?: string;
  recordedAt: string;
  importedAt?: string;
  locationText?: string;
  peopleInvolved?: string[];
  tags?: string[];
  fileRef?: string;
  originalFilename?: string;
  mimeType?: string;
  sha256?: string;
  redactions?: RedactionRegion[];
  includeInExport: boolean;
  redactionStatus: "none" | "partial" | "full";
  dateCertainty: "exact" | "approximate" | "unknown";
  createdAt: string;
  updatedAt: string;
};

export type ExportBundle = {
  id: string;
  caseId: string;
  mode: "full" | "redacted";
  createdAt: string;
  itemIds: string[];
  manifestRef: string;
  archiveRef?: string;
};

export type AttachmentRecord = {
  id: string;
  evidenceItemId: string;
  blob: Blob;
  sizeBytes: number;
  mimeType: string;
  originalFilename: string;
  createdAt: string;
  updatedAt?: string;
};

export type LedgerEntry = {
  id: string;
  timestamp: string;
  event: string;
  caseId?: string;
  attachmentId?: string;
  data?: Record<string, unknown>;
  prevHash?: string;
  hash: string;
};
