import type { AttachmentRecord, CaseFile, EvidenceItem, ExportBundle, LedgerEntry, RedactionRegion, VaultMeta } from "../domain/types";
import { db } from "./index";
import {
  decryptCaseFileFromStorage,
  decryptEvidenceItemFromStorage,
  encryptCaseFileForStorage,
  encryptEvidenceItemForStorage,
} from "../features/security/storage";
import { decryptAttachmentRecord } from "../features/vault/attachmentCrypto";
import { getSessionKey } from "../features/security/session";

async function hydrateCaseFile(caseFile: CaseFile | undefined): Promise<CaseFile | undefined> {
  if (!caseFile) {
    return undefined;
  }

  return decryptCaseFileFromStorage(caseFile);
}

async function hydrateEvidenceItem(evidenceItem: EvidenceItem | undefined): Promise<EvidenceItem | undefined> {
  if (!evidenceItem) {
    return undefined;
  }

  return decryptEvidenceItemFromStorage(evidenceItem);
}

async function hydrateAttachmentRecord(
  attachmentRecord: AttachmentRecord | undefined
): Promise<AttachmentRecord | undefined> {
  if (!attachmentRecord) {
    return undefined;
  }

  return decryptAttachmentRecord(attachmentRecord, getSessionKey());
}

export async function listCases(): Promise<CaseFile[]> {
  const items = await db.cases.orderBy("updatedAt").reverse().toArray();
  return Promise.all(items.map((item) => decryptCaseFileFromStorage(item)));
}

export async function getCasesForSelect(): Promise<Array<{ id: string; title: string }>> {
  const cases = await listCases();
  return cases.map((caseFile) => ({ id: caseFile.id, title: caseFile.title }));
}

export async function listEvidenceItems(): Promise<EvidenceItem[]> {
  const items = await db.evidenceItems.orderBy("recordedAt").reverse().toArray();
  return Promise.all(items.map((item) => decryptEvidenceItemFromStorage(item)));
}

export async function listTimelineItems(): Promise<EvidenceItem[]> {
  return listEvidenceItems();
}

export async function listTimelineEvidenceItems(): Promise<EvidenceItem[]> {
  return listTimelineItems();
}

export async function listUnassignedEvidenceItems(): Promise<EvidenceItem[]> {
  const items = await db.evidenceItems.filter((item) => !item.caseId).toArray();
  const hydrated = await Promise.all(items.map((item) => decryptEvidenceItemFromStorage(item)));
  return hydrated.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function listInboxEvidenceItems(): Promise<EvidenceItem[]> {
  return listEvidenceItems();
}

export async function listEvidenceItemsForCase(caseId: string): Promise<EvidenceItem[]> {
  const items = await db.evidenceItems.where("caseId").equals(caseId).toArray();
  const hydrated = await Promise.all(items.map((item) => decryptEvidenceItemFromStorage(item)));
  return hydrated.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function getEvidenceItemById(evidenceId: string): Promise<EvidenceItem | undefined> {
  return hydrateEvidenceItem(await db.evidenceItems.get(evidenceId));
}

export async function getCaseById(caseId: string): Promise<CaseFile | undefined> {
  return hydrateCaseFile(await db.cases.get(caseId));
}

export async function updateEvidenceControls(
  evidenceId: string,
  values: Pick<EvidenceItem, "includeInExport" | "redactionStatus" | "description">
): Promise<void> {
  const existing = await db.evidenceItems.get(evidenceId);
  if (!existing) {
    return;
  }

  const hydrated = await decryptEvidenceItemFromStorage(existing);
  const next = await encryptEvidenceItemForStorage({
    ...hydrated,
    includeInExport: values.includeInExport,
    redactionStatus: values.redactionStatus,
    description: values.description,
    updatedAt: new Date().toISOString(),
  });

  await db.evidenceItems.put(next);
}

export async function updateEvidenceRedactions(
  evidenceId: string,
  redactions: RedactionRegion[]
): Promise<void> {
  const existing = await db.evidenceItems.get(evidenceId);
  if (!existing) {
    return;
  }

  const hydrated = await decryptEvidenceItemFromStorage(existing);
  const next = await encryptEvidenceItemForStorage({
    ...hydrated,
    redactions,
    redactionStatus: redactions.length > 0 ? "partial" : "none",
    updatedAt: new Date().toISOString(),
  });

  await db.evidenceItems.put(next);
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
  return db.cases.put(await encryptCaseFileForStorage(caseFile));
}

export async function upsertEvidenceItem(evidenceItem: EvidenceItem): Promise<string> {
  return db.evidenceItems.put(await encryptEvidenceItemForStorage(evidenceItem));
}

export async function createEvidenceItem(evidenceItem: EvidenceItem): Promise<string> {
  return db.evidenceItems.add(await encryptEvidenceItemForStorage(evidenceItem));
}

export async function createAttachmentRecord(attachmentRecord: AttachmentRecord): Promise<string> {
  return db.attachments.add(attachmentRecord);
}

export async function getAttachmentRecordById(attachmentId: string): Promise<AttachmentRecord | undefined> {
  return db.attachments.get(attachmentId);
}

export async function getHydratedAttachmentRecordById(
  attachmentId: string
): Promise<AttachmentRecord | undefined> {
  return hydrateAttachmentRecord(await db.attachments.get(attachmentId));
}

export async function getAttachmentByEvidenceItemId(
  evidenceItemId: string
): Promise<AttachmentRecord | undefined> {
  return db.attachments.where("evidenceItemId").equals(evidenceItemId).first();
}

export async function getHydratedAttachmentByEvidenceItemId(
  evidenceItemId: string
): Promise<AttachmentRecord | undefined> {
  return hydrateAttachmentRecord(await db.attachments.where("evidenceItemId").equals(evidenceItemId).first());
}

export async function getEvidenceItemByAttachmentId(
  attachmentId: string
): Promise<EvidenceItem | undefined> {
  return hydrateEvidenceItem(await db.evidenceItems.where("fileRef").equals(attachmentId).first());
}

export async function createAttachmentAndEvidenceItem(
  attachmentRecord: AttachmentRecord,
  evidenceItem: EvidenceItem
): Promise<string> {
  const encryptedEvidenceItem = await encryptEvidenceItemForStorage(evidenceItem);

  await db.transaction("rw", db.attachments, db.evidenceItems, async () => {
    await db.attachments.add(attachmentRecord);
    await db.evidenceItems.add(encryptedEvidenceItem);
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
