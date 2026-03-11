import type { AttachmentRecord } from "../../domain/types";
import { db } from "../../db/index";
import { getSessionKeyOrThrow, prepareSessionConfig, verifyPassphrase, applyPreparedSessionConfig } from "./session";
import {
  decryptCaseFileFromStorageWithKey,
  decryptEvidenceItemFromStorageWithKey,
  encryptCaseFileForStorageWithKey,
  encryptEvidenceItemForStorageWithKey,
} from "./storage";
import { decryptBlob, encryptBlob } from "../../lib/crypto/aes";

async function reencryptAttachment(
  attachment: AttachmentRecord,
  previousKey: CryptoKey,
  nextKey: CryptoKey
): Promise<AttachmentRecord> {
  if (!attachment.encrypted || !attachment.encryptionIv) {
    return attachment;
  }

  const ciphertext = await attachment.blob.arrayBuffer();
  const plainBlob = await decryptBlob(ciphertext, attachment.encryptionIv, attachment.mimeType, previousKey);
  const { ciphertext: newCiphertext, iv: newIv } = await encryptBlob(plainBlob, nextKey);

  return {
    ...attachment,
    blob: new Blob([newCiphertext]),
    encryptionIv: newIv,
  };
}

export async function rotatePassphrase(currentPassphrase: string, nextPassphrase: string): Promise<{
  casesUpdated: number;
  evidenceUpdated: number;
  attachmentsUpdated: number;
}> {
  if (currentPassphrase === nextPassphrase) {
    throw new Error("New passphrase must be different from the current passphrase.");
  }

  await verifyPassphrase(currentPassphrase);

  const previousKey = getSessionKeyOrThrow();
  const preparedConfig = await prepareSessionConfig(nextPassphrase);
  const [cases, evidenceItems, attachments] = await Promise.all([
    db.cases.toArray(),
    db.evidenceItems.toArray(),
    db.attachments.toArray(),
  ]);

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

  const reencryptedAttachments = await Promise.all(
    attachments.map((attachment) => reencryptAttachment(attachment, previousKey, preparedConfig.key))
  );

  await db.transaction("rw", db.cases, db.evidenceItems, db.attachments, async () => {
    await db.cases.bulkPut(reencryptedCases);
    await db.evidenceItems.bulkPut(reencryptedEvidence);
    await db.attachments.bulkPut(reencryptedAttachments);
  });

  applyPreparedSessionConfig(preparedConfig);

  return {
    casesUpdated: reencryptedCases.length,
    evidenceUpdated: reencryptedEvidence.length,
    attachmentsUpdated: reencryptedAttachments.length,
  };
}