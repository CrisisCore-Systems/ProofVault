import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAttachment } from "./attachmentActions";

const {
  createAttachmentAndEvidenceItemMock,
  appendLedgerEventMock,
  sha256HexFromBlobMock,
  encryptBlobMock,
} = vi.hoisted(() => ({
  createAttachmentAndEvidenceItemMock: vi.fn(),
  appendLedgerEventMock: vi.fn(),
  sha256HexFromBlobMock: vi.fn(),
  encryptBlobMock: vi.fn(),
}));

vi.mock("../../db/queries", () => ({
  createAttachmentAndEvidenceItem: createAttachmentAndEvidenceItemMock,
}));

vi.mock("../ledger/chain", () => ({
  appendLedgerEvent: appendLedgerEventMock,
}));

vi.mock("../../lib/hashing/sha256", () => ({
  sha256HexFromBlob: sha256HexFromBlobMock,
}));

vi.mock("../../lib/crypto/aes", () => ({
  encryptBlob: encryptBlobMock,
}));

describe("saveAttachment", () => {
  beforeEach(() => {
    createAttachmentAndEvidenceItemMock.mockReset();
    createAttachmentAndEvidenceItemMock.mockResolvedValue("evidence-1");
    appendLedgerEventMock.mockReset();
    appendLedgerEventMock.mockResolvedValue(undefined);
    sha256HexFromBlobMock.mockReset();
    sha256HexFromBlobMock.mockResolvedValue("a".repeat(64));
    encryptBlobMock.mockReset();
    encryptBlobMock.mockResolvedValue({
      ciphertext: new Uint8Array([1, 2, 3, 4]).buffer,
      iv: new Uint8Array([9, 8, 7, 6]),
    });
  });

  it("always encrypts imported attachments before storing them", async () => {
    const file = new File(["photo-bytes"], "door-photo.jpg", { type: "image/jpeg" });
    const encryptionKey = { id: "vault-key" } as unknown as CryptoKey;

    await saveAttachment(
      {
        title: "Door photo",
        description: "",
        caseId: "case-1",
        recordedAt: "2026-03-12T09:30",
      },
      file,
      encryptionKey
    );

    expect(encryptBlobMock).toHaveBeenCalledWith(file, encryptionKey);
    expect(createAttachmentAndEvidenceItemMock).toHaveBeenCalledTimes(1);

    const [attachmentRecord, evidenceItem] = createAttachmentAndEvidenceItemMock.mock.calls[0];

    expect(attachmentRecord).toMatchObject({
      evidenceItemId: evidenceItem.id,
      mimeType: "image/jpeg",
      originalFilename: "door-photo.jpg",
      sizeBytes: file.size,
      encrypted: true,
      encryptionIv: new Uint8Array([9, 8, 7, 6]),
    });
    expect(attachmentRecord.blob).toBeInstanceOf(Blob);
    expect(attachmentRecord.blob.size).toBe(4);
    expect(evidenceItem.sha256).toBe("a".repeat(64));

    expect(appendLedgerEventMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: "ATTACHMENT_ADDED",
        data: expect.objectContaining({ encrypted: true }),
      })
    );
  });
});