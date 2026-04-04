import type { AttachmentRecord, CaseFile, EvidenceItem } from "../../domain/types";
import { db } from "../../db/index";
import { encryptCaseFileForStorage, encryptEvidenceItemForStorage } from "./storage";
import { encryptAttachmentRecordForStorage } from "../vault/attachmentCrypto";

function caseNeedsMigration(caseFile: CaseFile): boolean {
  return Boolean(caseFile.description && !caseFile.encryptedPayload);
}

function evidenceNeedsMigration(evidenceItem: EvidenceItem): boolean {
  return Boolean(
    !evidenceItem.encryptedPayload &&
      (evidenceItem.description ||
        evidenceItem.locationText ||
        (evidenceItem.peopleInvolved?.length ?? 0) > 0 ||
        (evidenceItem.tags?.length ?? 0) > 0)
  );
}

function attachmentNeedsMigration(attachmentRecord: AttachmentRecord): boolean {
  return !attachmentRecord.encrypted || !attachmentRecord.encryptionIv;
}

export async function migrateExistingSensitiveData(): Promise<{
  casesUpdated: number;
  evidenceUpdated: number;
  attachmentsUpdated: number;
}> {
  const [cases, evidenceItems, attachments] = await Promise.all([
    db.cases.toArray(),
    db.evidenceItems.toArray(),
    db.attachments.toArray(),
  ]);

  const casesToUpdate = cases.filter(caseNeedsMigration);
  const evidenceToUpdate = evidenceItems.filter(evidenceNeedsMigration);
  const attachmentsToUpdate = attachments.filter(attachmentNeedsMigration);

  if (casesToUpdate.length === 0 && evidenceToUpdate.length === 0 && attachmentsToUpdate.length === 0) {
    return { casesUpdated: 0, evidenceUpdated: 0, attachmentsUpdated: 0 };
  }

  const encryptedCases = await Promise.all(casesToUpdate.map((caseFile) => encryptCaseFileForStorage(caseFile)));
  const encryptedEvidence = await Promise.all(
    evidenceToUpdate.map((evidenceItem) => encryptEvidenceItemForStorage(evidenceItem))
  );
  const encryptedAttachments = await Promise.all(
    attachmentsToUpdate.map((attachmentRecord) => encryptAttachmentRecordForStorage(attachmentRecord))
  );

  await db.transaction("rw", db.cases, db.evidenceItems, db.attachments, async () => {
    if (encryptedCases.length > 0) {
      await db.cases.bulkPut(encryptedCases);
    }

    if (encryptedEvidence.length > 0) {
      await db.evidenceItems.bulkPut(encryptedEvidence);
    }

    if (encryptedAttachments.length > 0) {
      await db.attachments.bulkPut(encryptedAttachments);
    }
  });

  return {
    casesUpdated: encryptedCases.length,
    evidenceUpdated: encryptedEvidence.length,
    attachmentsUpdated: encryptedAttachments.length,
  };
}