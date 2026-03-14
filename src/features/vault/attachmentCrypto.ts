import type { AttachmentRecord } from "../../domain/types";
import { decryptBlob } from "../../lib/crypto/aes";

export async function decryptAttachmentRecord(
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
