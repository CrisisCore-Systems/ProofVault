import type { AttachmentRecord, CaseFile, EvidenceItem, ExportBundle, LedgerEntry, RedactionRegion, VaultMeta } from "../domain/types";
import { db } from "./index";

export async function listCases(): Promise<CaseFile[]> {
  return db.cases.orderBy("updatedAt").reverse().toArray();
}

export async function getCasesForSelect(): Promise<Array<{ id: string; title: string }>> {
  const cases = await listCases();
  return cases.map((caseFile) => ({ id: caseFile.id, title: caseFile.title }));
}

export async function listEvidenceItems(): Promise<EvidenceItem[]> {
  return db.evidenceItems.orderBy("recordedAt").reverse().toArray();
}

export async function listTimelineItems(): Promise<EvidenceItem[]> {
  return db.evidenceItems.orderBy("recordedAt").reverse().toArray();
}

export async function listTimelineEvidenceItems(): Promise<EvidenceItem[]> {
  return listTimelineItems();
}

export async function listUnassignedEvidenceItems(): Promise<EvidenceItem[]> {
  const items = await db.evidenceItems.filter((item) => !item.caseId).toArray();
  return items.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function listInboxEvidenceItems(): Promise<EvidenceItem[]> {
  return db.evidenceItems.orderBy("recordedAt").reverse().toArray();
}

export async function listEvidenceItemsForCase(caseId: string): Promise<EvidenceItem[]> {
  const items = await db.evidenceItems.where("caseId").equals(caseId).toArray();
  return items.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function getEvidenceItemById(evidenceId: string): Promise<EvidenceItem | undefined> {
  return db.evidenceItems.get(evidenceId);
}

export async function getCaseById(caseId: string): Promise<CaseFile | undefined> {
  return db.cases.get(caseId);
}

export async function updateEvidenceControls(
  evidenceId: string,
  values: Pick<EvidenceItem, "includeInExport" | "redactionStatus" | "description">
): Promise<void> {
  await db.evidenceItems.update(evidenceId, {
    includeInExport: values.includeInExport,
    redactionStatus: values.redactionStatus,
    description: values.description,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateEvidenceRedactions(
  evidenceId: string,
  redactions: RedactionRegion[]
): Promise<void> {
  await db.evidenceItems.update(evidenceId, {
    redactions,
    redactionStatus: redactions.length > 0 ? "partial" : "none",
    updatedAt: new Date().toISOString(),
  });
}

export async function updateCaseLastVerifiedAt(caseId: string, lastVerifiedAt: string): Promise<void> {
  await db.cases.update(caseId, {
    lastVerifiedAt,
    updatedAt: new Date().toISOString(),
  });
}

export async function listExportBundles(): Promise<ExportBundle[]> {
  return db.exportBundles.orderBy("createdAt").reverse().toArray();
}

export async function upsertCaseFile(caseFile: CaseFile): Promise<string> {
  return db.cases.put(caseFile);
}

export async function upsertEvidenceItem(evidenceItem: EvidenceItem): Promise<string> {
  return db.evidenceItems.put(evidenceItem);
}

export async function createEvidenceItem(evidenceItem: EvidenceItem): Promise<string> {
  return db.evidenceItems.add(evidenceItem);
}

export async function createAttachmentRecord(attachmentRecord: AttachmentRecord): Promise<string> {
  return db.attachments.add(attachmentRecord);
}

export async function getAttachmentRecordById(attachmentId: string): Promise<AttachmentRecord | undefined> {
  return db.attachments.get(attachmentId);
}

export async function getAttachmentByEvidenceItemId(
  evidenceItemId: string
): Promise<AttachmentRecord | undefined> {
  return db.attachments.where("evidenceItemId").equals(evidenceItemId).first();
}

export async function getEvidenceItemByAttachmentId(
  attachmentId: string
): Promise<EvidenceItem | undefined> {
  return db.evidenceItems.where("fileRef").equals(attachmentId).first();
}

export async function createAttachmentAndEvidenceItem(
  attachmentRecord: AttachmentRecord,
  evidenceItem: EvidenceItem
): Promise<string> {
  await db.transaction("rw", db.attachments, db.evidenceItems, async () => {
    await db.attachments.add(attachmentRecord);
    await db.evidenceItems.add(evidenceItem);
  });

  return evidenceItem.id;
}

export async function upsertExportBundle(exportBundle: ExportBundle): Promise<string> {
  return db.exportBundles.put(exportBundle);
}

export async function appendLedgerEntry(ledgerEntry: LedgerEntry): Promise<string> {
  return db.ledger.add(ledgerEntry);
}

export async function getLatestLedgerEntry(): Promise<LedgerEntry | undefined> {
  return db.ledger.orderBy("timestamp").last();
}

export async function getLatestLedgerEntryForAttachment(
  attachmentId: string
): Promise<LedgerEntry | undefined> {
  const entries = await db.ledger.where("attachmentId").equals(attachmentId).sortBy("timestamp");
  return entries.at(-1);
}

export async function listLedgerEntries(): Promise<LedgerEntry[]> {
  return db.ledger.orderBy("timestamp").toArray();
}

export async function getVaultMeta(): Promise<VaultMeta | undefined> {
  return db.vaultMeta.get("singleton");
}

export async function saveVaultMeta(meta: VaultMeta): Promise<void> {
  await db.vaultMeta.put(meta);
}
