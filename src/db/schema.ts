import Dexie, { type Table } from "dexie";
import type { AttachmentRecord, CaseFile, EvidenceItem, ExportBundle, LedgerEntry } from "../domain/types";

export class ProofVaultDB extends Dexie {
  cases!: Table<CaseFile, string>;
  evidenceItems!: Table<EvidenceItem, string>;
  exportBundles!: Table<ExportBundle, string>;
  attachments!: Table<AttachmentRecord, string>;
  ledger!: Table<LedgerEntry, string>;

  constructor() {
    super("proofvault-db");

    this.version(1).stores({
      cases: "id, status, type, updatedAt",
      evidenceItems: "id, caseId, kind, recordedAt, occurredAt, includeInExport, updatedAt",
      exportBundles: "id, caseId, mode, createdAt",
    });

    this.version(2).stores({
      cases: "id, status, type, updatedAt",
      evidenceItems: "id, caseId, kind, recordedAt, occurredAt, includeInExport, updatedAt",
      exportBundles: "id, caseId, mode, createdAt",
      attachments: "id, evidenceItemId, createdAt, mimeType",
    });

    this.version(3).stores({
      cases: "id, status, type, updatedAt",
      evidenceItems: "id, caseId, kind, recordedAt, occurredAt, includeInExport, updatedAt, fileRef",
      exportBundles: "id, caseId, mode, createdAt",
      attachments: "id, evidenceItemId, createdAt, mimeType",
    });

    this.version(4).stores({
      cases: "id, status, type, updatedAt, lastVerifiedAt",
      evidenceItems: "id, caseId, kind, recordedAt, occurredAt, includeInExport, updatedAt, fileRef",
      exportBundles: "id, caseId, mode, createdAt",
      attachments: "id, evidenceItemId, createdAt, mimeType",
    });

    this.version(5).stores({
      cases: "id, status, type, updatedAt, lastVerifiedAt",
      evidenceItems: "id, caseId, kind, recordedAt, occurredAt, includeInExport, updatedAt, fileRef",
      exportBundles: "id, caseId, mode, createdAt",
      attachments: "id, evidenceItemId, createdAt, mimeType",
      ledger: "id, timestamp, event, caseId, attachmentId",
    });
  }
}
