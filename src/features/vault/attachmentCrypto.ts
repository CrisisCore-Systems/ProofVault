import type { AttachmentRecord } from "../../domain/types";
import { decryptBlob, encryptBlob } from "../../lib/crypto/aes";
import { getSessionKeyOrThrow, hasConfiguredAppLock } from "../security/session";

export async function encryptAttachmentRecordForStorageWithKey(
  record: AttachmentRecord,
  key: CryptoKey
): Promise<AttachmentRecord> {
  if (record.encrypted && record.encryptionIv) {
    return record;
  }

  const encrypted = await encryptBlob(record.blob, key);

  return {
    ...record,
    blob: new Blob([encrypted.ciphertext], { type: record.mimeType || "application/octet-stream" }),
    encrypted: true,
    encryptionIv: encrypted.iv,
  };
}

export async function encryptAttachmentRecordForStorage(record: AttachmentRecord): Promise<AttachmentRecord> {
  if (record.encrypted && record.encryptionIv) {
    return record;
  }

  if (!hasConfiguredAppLock()) {
    return {
      ...record,
      encrypted: false,
      encryptionIv: undefined,
    };
  }

  return encryptAttachmentRecordForStorageWithKey(record, getSessionKeyOrThrow());
}

export async function decryptAttachmentRecord(
  record: AttachmentRecord,
  key: CryptoKey | null
): Promise<AttachmentRecord> {
  if (!record.encrypted || !record.encryptionIv) {
    return record;
  }

  if (!key) {
    throw new Error("Vault is locked. Unlock the vault to access encrypted attachments.");
  }

  const ciphertext = await record.blob.arrayBuffer();
  const plainBlob = await decryptBlob(ciphertext, record.encryptionIv, record.mimeType, key);

  return { ...record, blob: plainBlob };
}
