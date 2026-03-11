import { describe, expect, it } from "vitest";
import type { AttachmentRecord } from "../../domain/types";
import {
  deserializeAttachmentFromBackup,
  serializeAttachmentForBackup,
} from "./backup";

const BASE_ATTACHMENT: AttachmentRecord = {
  id: "att-1",
  evidenceItemId: "ev-1",
  blob: new Blob([new Uint8Array([10, 20, 30, 40])], { type: "image/jpeg" }),
  sizeBytes: 4,
  mimeType: "image/jpeg",
  originalFilename: "evidence.jpg",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("backup attachment serialization round-trip", () => {
  describe("serializeAttachmentForBackup — encrypted attachment", () => {
    it("converts encryptionIv Uint8Array to a base64 string (not raw bytes)", async () => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const attachment: AttachmentRecord = {
        ...BASE_ATTACHMENT,
        encrypted: true,
        encryptionIv: iv,
      };

      const serialized = await serializeAttachmentForBackup(attachment);

      expect(serialized.encrypted).toBe(true);
      expect(typeof serialized.encryptionIvBase64).toBe("string");
      expect(serialized.encryptionIvBase64!.length).toBeGreaterThan(0);
      // Verify raw Uint8Array is not present — object should only have the base64 key
      expect(serialized).not.toHaveProperty("encryptionIv");
    });

    it("encodes blob bytes as a base64 string", async () => {
      const blobBytes = new Uint8Array([1, 2, 3, 255]);
      const attachment: AttachmentRecord = {
        ...BASE_ATTACHMENT,
        blob: new Blob([blobBytes], { type: "application/octet-stream" }),
        mimeType: "application/octet-stream",
        encrypted: true,
        encryptionIv: crypto.getRandomValues(new Uint8Array(12)),
      };

      const serialized = await serializeAttachmentForBackup(attachment);

      expect(typeof serialized.blobBase64).toBe("string");
      expect(serialized.blobBase64.length).toBeGreaterThan(0);
      expect(serialized).not.toHaveProperty("blob");
    });

    it("preserves all non-binary metadata fields unchanged", async () => {
      const attachment: AttachmentRecord = {
        ...BASE_ATTACHMENT,
        encrypted: true,
        encryptionIv: crypto.getRandomValues(new Uint8Array(12)),
      };

      const serialized = await serializeAttachmentForBackup(attachment);

      expect(serialized.id).toBe(BASE_ATTACHMENT.id);
      expect(serialized.evidenceItemId).toBe(BASE_ATTACHMENT.evidenceItemId);
      expect(serialized.sizeBytes).toBe(BASE_ATTACHMENT.sizeBytes);
      expect(serialized.mimeType).toBe(BASE_ATTACHMENT.mimeType);
      expect(serialized.originalFilename).toBe(BASE_ATTACHMENT.originalFilename);
      expect(serialized.createdAt).toBe(BASE_ATTACHMENT.createdAt);
      expect(serialized.updatedAt).toBe(BASE_ATTACHMENT.updatedAt);
    });
  });

  describe("serializeAttachmentForBackup — unencrypted attachment", () => {
    it("omits encryptionIvBase64 when no IV is present", async () => {
      const attachment: AttachmentRecord = {
        ...BASE_ATTACHMENT,
        encrypted: undefined,
        encryptionIv: undefined,
      };

      const serialized = await serializeAttachmentForBackup(attachment);

      expect(serialized.encrypted).toBeUndefined();
      expect(serialized.encryptionIvBase64).toBeUndefined();
    });
  });

  describe("deserializeAttachmentFromBackup — encrypted attachment", () => {
    it("restores encryptionIv as Uint8Array from base64", async () => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const attachment: AttachmentRecord = {
        ...BASE_ATTACHMENT,
        encrypted: true,
        encryptionIv: iv,
      };

      const serialized = await serializeAttachmentForBackup(attachment);
      const restored = deserializeAttachmentFromBackup(serialized);

      expect(restored.encrypted).toBe(true);
      expect(restored.encryptionIv).toBeInstanceOf(Uint8Array);
      expect(Array.from(restored.encryptionIv!)).toEqual(Array.from(iv));
    });

    it("restores blob with the original MIME type", async () => {
      const attachment: AttachmentRecord = {
        ...BASE_ATTACHMENT,
        encrypted: true,
        encryptionIv: crypto.getRandomValues(new Uint8Array(12)),
      };

      const serialized = await serializeAttachmentForBackup(attachment);
      const restored = deserializeAttachmentFromBackup(serialized);

      expect(restored.blob.type).toBe("image/jpeg");
    });
  });

  describe("full round-trip", () => {
    it("encrypted attachment: all fields identical after export then import", async () => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const blobBytes = new Uint8Array([5, 10, 15, 20, 25]);
      const original: AttachmentRecord = {
        id: "att-rt-enc",
        evidenceItemId: "ev-rt",
        blob: new Blob([blobBytes], { type: "image/png" }),
        sizeBytes: blobBytes.length,
        mimeType: "image/png",
        originalFilename: "screenshot.png",
        createdAt: "2026-03-01T09:00:00.000Z",
        updatedAt: "2026-03-02T10:00:00.000Z",
        encrypted: true,
        encryptionIv: iv,
      };

      const serialized = await serializeAttachmentForBackup(original);
      const restored = deserializeAttachmentFromBackup(serialized);

      // Scalar fields
      expect(restored.id).toBe(original.id);
      expect(restored.evidenceItemId).toBe(original.evidenceItemId);
      expect(restored.sizeBytes).toBe(original.sizeBytes);
      expect(restored.mimeType).toBe(original.mimeType);
      expect(restored.originalFilename).toBe(original.originalFilename);
      expect(restored.createdAt).toBe(original.createdAt);
      expect(restored.updatedAt).toBe(original.updatedAt);
      expect(restored.encrypted).toBe(true);

      // IV bytes identical
      expect(Array.from(restored.encryptionIv!)).toEqual(Array.from(iv));

      // Blob bytes identical
      const restoredBytes = new Uint8Array(await restored.blob.arrayBuffer());
      expect(Array.from(restoredBytes)).toEqual(Array.from(blobBytes));
    });

    it("unencrypted attachment: blob and metadata survive round-trip without IV fields", async () => {
      const blobBytes = new Uint8Array([99, 88, 77]);
      const original: AttachmentRecord = {
        id: "att-rt-plain",
        evidenceItemId: "ev-rt-plain",
        blob: new Blob([blobBytes], { type: "application/pdf" }),
        sizeBytes: blobBytes.length,
        mimeType: "application/pdf",
        originalFilename: "lease.pdf",
        createdAt: "2026-03-05T08:00:00.000Z",
        updatedAt: undefined,
        encrypted: undefined,
        encryptionIv: undefined,
      };

      const serialized = await serializeAttachmentForBackup(original);
      const restored = deserializeAttachmentFromBackup(serialized);

      expect(restored.encrypted).toBeUndefined();
      expect(restored.encryptionIv).toBeUndefined();

      const restoredBytes = new Uint8Array(await restored.blob.arrayBuffer());
      expect(Array.from(restoredBytes)).toEqual(Array.from(blobBytes));
    });

    it("malformed base64 IV produces an Uint8Array of wrong length, not a silent match", async () => {
      // If a backup has a corrupted (truncated) IV, deserialize should not silently produce a valid IV
      const truncatedIvBase64 = btoa(String.fromCodePoint(1, 2));  // only 2 bytes instead of 12
      const serialized = {
        id: "att-bad",
        evidenceItemId: "ev-bad",
        blobBase64: btoa(String.fromCodePoint(1, 2, 3)),
        sizeBytes: 3,
        mimeType: "image/jpeg",
        originalFilename: "bad.jpg",
        createdAt: "2026-01-01T00:00:00.000Z",
        encrypted: true as const,
        encryptionIvBase64: truncatedIvBase64,
      };

      const restored = deserializeAttachmentFromBackup(serialized);

      // The IV is restored but is too short — not 12 bytes — making it unusable for AES-GCM decryption
      expect(restored.encryptionIv).toBeInstanceOf(Uint8Array);
      expect(restored.encryptionIv!.length).not.toBe(12);
    });
  });
});
