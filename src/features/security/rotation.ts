import { db } from "../../db/index";
import { getSessionKeyOrThrow, prepareSessionConfig, verifyPassphrase, applyPreparedSessionConfig } from "./session";
import {
  decryptCaseFileFromStorageWithKey,
  decryptEvidenceItemFromStorageWithKey,
  encryptCaseFileForStorageWithKey,
  encryptEvidenceItemForStorageWithKey,
} from "./storage";

export async function rotatePassphrase(currentPassphrase: string, nextPassphrase: string): Promise<{
  casesUpdated: number;
  evidenceUpdated: number;
}> {
  if (currentPassphrase === nextPassphrase) {
    throw new Error("New passphrase must be different from the current passphrase.");
  }

  await verifyPassphrase(currentPassphrase);

  const previousKey = getSessionKeyOrThrow();
  const preparedConfig = await prepareSessionConfig(nextPassphrase);
  const [cases, evidenceItems] = await Promise.all([db.cases.toArray(), db.evidenceItems.toArray()]);

  const reencryptedCases = await Promise.all(
    cases.map(async (caseFile) => {
      const decrypted = await decryptCaseFileFromStorageWithKey(caseFile, previousKey);
      return encryptCaseFileForStorageWithKey(decrypted, preparedConfig.key);
    })
  );

  const reencryptedEvidence = await Promise.all(
    evidenceItems.map(async (evidenceItem) => {
      const decrypted = await decryptEvidenceItemFromStorageWithKey(evidenceItem, previousKey);
      return encryptEvidenceItemForStorageWithKey(decrypted, preparedConfig.key);
    })
  );

  await db.transaction("rw", db.cases, db.evidenceItems, async () => {
    await db.cases.bulkPut(reencryptedCases);
    await db.evidenceItems.bulkPut(reencryptedEvidence);
  });

  applyPreparedSessionConfig(preparedConfig);

  return {
    casesUpdated: reencryptedCases.length,
    evidenceUpdated: reencryptedEvidence.length,
  };
}