import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttachmentRecord } from "../../domain/types";
import { decryptAttachmentRecord } from "./attachmentCrypto";

const decryptBlobMock = vi.fn();

vi.mock("../../lib/crypto/aes", () => ({
  decryptBlob: decryptBlobMock,
}));

function createAttachmentRecord(overrides: Partial<AttachmentRecord> = {}): AttachmentRecord {
  return {
    id: overrides.id ?? "att-1",
    evidenceItemId: overrides.evidenceItemId ?? "item-1",
    blob: overrides.blob ?? new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    sizeBytes: overrides.sizeBytes ?? 3,
    mimeType: overrides.mimeType ?? "image/jpeg",
    originalFilename: overrides.originalFilename ?? "door-photo.jpg",
    createdAt: overrides.createdAt ?? "2026-03-10T12:00:00.000Z",
    updatedAt: overrides.updatedAt,
    encrypted: overrides.encrypted,
    encryptionIv: overrides.encryptionIv,
  };
}

describe("decryptAttachmentRecord", () => {
  beforeEach(() => {
    decryptBlobMock.mockReset();
  });

  it("passes plaintext attachments through unchanged", async () => {
    const record = createAttachmentRecord({ encrypted: false, encryptionIv: undefined });

    await expect(decryptAttachmentRecord(record, null)).resolves.toBe(record);
    expect(decryptBlobMock).not.toHaveBeenCalled();
  });

  it("decrypts encrypted attachments with the active vault key", async () => {
    const decryptedBlob = new Blob(["plain"], { type: "image/jpeg" });
    const record = createAttachmentRecord({ encrypted: true, encryptionIv: new Uint8Array([4, 5, 6]) });
    const key = { id: "vault-key" } as unknown as CryptoKey;

    decryptBlobMock.mockResolvedValue(decryptedBlob);

    const result = await decryptAttachmentRecord(record, key);

    expect(decryptBlobMock).toHaveBeenCalledWith(
      await record.blob.arrayBuffer(),
      new Uint8Array([4, 5, 6]),
      "image/jpeg",
      key
    );
    expect(result).toEqual({
      ...record,
      blob: decryptedBlob,
    });
  });

  it("fails closed when an encrypted attachment is accessed without a vault key", async () => {
    const record = createAttachmentRecord({ encrypted: true, encryptionIv: new Uint8Array([4, 5, 6]) });

    await expect(decryptAttachmentRecord(record, null)).rejects.toThrow(
      "Vault is locked. Unlock the vault to access encrypted attachments."
    );
  });
});