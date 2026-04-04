import { describe, expect, it } from "vitest";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import {
  decryptCaseFileFromStorageWithKey,
  decryptEvidenceItemFromStorageWithKey,
  encryptCaseFileForStorageWithKey,
  encryptEvidenceItemForStorageWithKey,
} from "./storage";

async function createTestKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new Uint8Array(32), "AES-GCM", false, ["encrypt", "decrypt"]);
}

const baseCaseFile: CaseFile = {
  id: "case-1",
  title: "Test Case",
  type: "housing",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const baseEvidenceItem: EvidenceItem = {
  id: "ev-1",
  kind: "note",
  title: "Test Evidence",
  recordedAt: "2026-01-01T00:00:00.000Z",
  includeInExport: true,
  redactionStatus: "none",
  dateCertainty: "exact",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("storage field-level encryption", () => {
  describe("CaseFile encryption", () => {
    it("removes the description plaintext and stores an encrypted payload", async () => {
      const key = await createTestKey();
      const caseFile: CaseFile = { ...baseCaseFile, description: "Sensitive description" };

      const encrypted = await encryptCaseFileForStorageWithKey(caseFile, key);

      expect(encrypted.description).toBeUndefined();
      expect(encrypted.encryptedPayload).toBeDefined();
      expect(encrypted.encryptedPayload?.ciphertext).toBeTruthy();
      expect(encrypted.encryptedPayload?.iv).toBeTruthy();
      expect(encrypted.encryptedPayload?.algorithm).toBe("AES-GCM");
    });

    it("returns no encrypted payload when no sensitive fields are present", async () => {
      const key = await createTestKey();
      const caseFile: CaseFile = { ...baseCaseFile };

      const encrypted = await encryptCaseFileForStorageWithKey(caseFile, key);

      expect(encrypted.encryptedPayload).toBeUndefined();
    });

    it("restores the description after decryption", async () => {
      const key = await createTestKey();
      const original: CaseFile = { ...baseCaseFile, description: "Original description" };

      const encrypted = await encryptCaseFileForStorageWithKey(original, key);
      const decrypted = await decryptCaseFileFromStorageWithKey(encrypted, key);

      expect(decrypted.description).toBe("Original description");
    });

    it("preserves non-sensitive fields through the round-trip", async () => {
      const key = await createTestKey();
      const original: CaseFile = { ...baseCaseFile, description: "Secret" };

      const encrypted = await encryptCaseFileForStorageWithKey(original, key);
      const decrypted = await decryptCaseFileFromStorageWithKey(encrypted, key);

      expect(decrypted.id).toBe(original.id);
      expect(decrypted.title).toBe(original.title);
      expect(decrypted.type).toBe(original.type);
      expect(decrypted.status).toBe(original.status);
    });

    it("returns case file unchanged when no encrypted payload is present", async () => {
      const key = await createTestKey();
      const caseFile: CaseFile = { ...baseCaseFile };

      const decrypted = await decryptCaseFileFromStorageWithKey(caseFile, key);

      expect(decrypted).toEqual(caseFile);
    });
  });

  describe("EvidenceItem encryption", () => {
    it("removes all sensitive fields and stores an encrypted payload", async () => {
      const key = await createTestKey();
      const item: EvidenceItem = {
        ...baseEvidenceItem,
        description: "Witness description",
        locationText: "123 Main St",
        peopleInvolved: ["Alice", "Bob"],
        tags: ["urgent"],
      };

      const encrypted = await encryptEvidenceItemForStorageWithKey(item, key);

      expect(encrypted.description).toBeUndefined();
      expect(encrypted.locationText).toBeUndefined();
      expect(encrypted.peopleInvolved).toBeUndefined();
      expect(encrypted.tags).toBeUndefined();
      expect(encrypted.encryptedPayload).toBeDefined();
    });

    it("returns no encrypted payload when no sensitive fields are present", async () => {
      const key = await createTestKey();
      const item: EvidenceItem = { ...baseEvidenceItem };

      const encrypted = await encryptEvidenceItemForStorageWithKey(item, key);

      expect(encrypted.encryptedPayload).toBeUndefined();
    });

    it("restores all sensitive fields after decryption", async () => {
      const key = await createTestKey();
      const original: EvidenceItem = {
        ...baseEvidenceItem,
        description: "Witness description",
        locationText: "123 Main St",
        peopleInvolved: ["Alice", "Bob"],
        tags: ["urgent"],
      };

      const encrypted = await encryptEvidenceItemForStorageWithKey(original, key);
      const decrypted = await decryptEvidenceItemFromStorageWithKey(encrypted, key);

      expect(decrypted.description).toBe("Witness description");
      expect(decrypted.locationText).toBe("123 Main St");
      expect(decrypted.peopleInvolved).toEqual(["Alice", "Bob"]);
      expect(decrypted.tags).toEqual(["urgent"]);
    });

    it("preserves non-sensitive fields through the round-trip", async () => {
      const key = await createTestKey();
      const original: EvidenceItem = { ...baseEvidenceItem, description: "Secret" };

      const encrypted = await encryptEvidenceItemForStorageWithKey(original, key);
      const decrypted = await decryptEvidenceItemFromStorageWithKey(encrypted, key);

      expect(decrypted.id).toBe(original.id);
      expect(decrypted.kind).toBe(original.kind);
      expect(decrypted.title).toBe(original.title);
      expect(decrypted.includeInExport).toBe(original.includeInExport);
    });

    it("returns evidence item unchanged when no encrypted payload is present", async () => {
      const key = await createTestKey();
      const item: EvidenceItem = { ...baseEvidenceItem };

      const decrypted = await decryptEvidenceItemFromStorageWithKey(item, key);

      expect(decrypted).toEqual(item);
    });
  });
});
