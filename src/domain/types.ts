export type CaseFile = {
  id: string;
  title: string;
  type: "housing" | "work" | "legal" | "medical" | "family" | "other";
  description?: string;
  encryptedPayload?: EncryptedPayload;
  status: "active" | "archived" | "draft";
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type EncryptedPayload = {
  version: 1;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
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
  encryptedPayload?: EncryptedPayload;
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
  mode: "full" | "redacted" | "minimal";
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
  encrypted?: boolean;
  encryptionIv?: Uint8Array;
};

export type VaultMeta = {
  id: "singleton";
  salt: Uint8Array;
  verifierCiphertext: ArrayBuffer;
  verifierIv: Uint8Array;
  createdAt: string;
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
