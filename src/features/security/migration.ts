import type { CaseFile, EvidenceItem } from "../../domain/types";
import { db } from "../../db/index";
import { encryptCaseFileForStorage, encryptEvidenceItemForStorage } from "./storage";

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

export async function migrateExistingSensitiveData(): Promise<{ casesUpdated: number; evidenceUpdated: number }> {
  const [cases, evidenceItems] = await Promise.all([db.cases.toArray(), db.evidenceItems.toArray()]);

  const casesToUpdate = cases.filter(caseNeedsMigration);
  const evidenceToUpdate = evidenceItems.filter(evidenceNeedsMigration);

  if (casesToUpdate.length === 0 && evidenceToUpdate.length === 0) {
    return { casesUpdated: 0, evidenceUpdated: 0 };
  }

  const encryptedCases = await Promise.all(casesToUpdate.map((caseFile) => encryptCaseFileForStorage(caseFile)));
  const encryptedEvidence = await Promise.all(
    evidenceToUpdate.map((evidenceItem) => encryptEvidenceItemForStorage(evidenceItem))
  );

  await db.transaction("rw", db.cases, db.evidenceItems, async () => {
    if (encryptedCases.length > 0) {
      await db.cases.bulkPut(encryptedCases);
    }

    if (encryptedEvidence.length > 0) {
      await db.evidenceItems.bulkPut(encryptedEvidence);
    }
  });

  return {
    casesUpdated: encryptedCases.length,
    evidenceUpdated: encryptedEvidence.length,
  };
}