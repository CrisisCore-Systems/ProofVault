import type { AttachmentRecord } from "../../domain/types";
import { getAttachmentByEvidenceItemId, getAttachmentRecordById } from "../../db/queries";
import { decryptBlob } from "../../lib/crypto/aes";

async function decryptAttachmentRecord(
  record: AttachmentRecord,
  key: CryptoKey | null
): Promise<AttachmentRecord> {
  if (!record.encrypted || !record.encryptionIv) {
    return record;
  }

  if (!key) {
    throw new Error("Vault is locked — cannot decrypt attachment");
  }

  const ciphertext = await record.blob.arrayBuffer();
  const plainBlob = await decryptBlob(ciphertext, record.encryptionIv, record.mimeType, key);

  return { ...record, blob: plainBlob };
}

export async function loadDecryptedAttachmentById(
  attachmentId: string,
  key: CryptoKey | null
): Promise<AttachmentRecord | undefined> {
  const record = await getAttachmentRecordById(attachmentId);
  if (!record) {
    return undefined;
  }

  return decryptAttachmentRecord(record, key);
}

export async function loadDecryptedAttachmentByEvidenceItemId(
  evidenceItemId: string,
  key: CryptoKey | null
): Promise<AttachmentRecord | undefined> {
  const record = await getAttachmentByEvidenceItemId(evidenceItemId);
  if (!record) {
    return undefined;
  }

  return decryptAttachmentRecord(record, key);
}
