import { describe, expect, it } from "vitest";
import { createRandomBase64, decryptJson, deriveAesKeyFromPassphrase, encryptJson } from "./crypto";

describe("security crypto helpers", () => {
  describe("createRandomBase64", () => {
    it("returns a base64 string that decodes to the requested byte length", () => {
      const result = createRandomBase64(16);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(Buffer.from(result, "base64").length).toBe(16);
    });

    it("produces unique values on each call", () => {
      const a = createRandomBase64(16);
      const b = createRandomBase64(16);
      expect(a).not.toBe(b);
    });
  });

  describe("deriveAesKeyFromPassphrase", () => {
    it("returns a non-extractable AES-GCM CryptoKey", async () => {
      const salt = createRandomBase64(16);
      const key = await deriveAesKeyFromPassphrase("long-enough-passphrase", salt);
      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.type).toBe("secret");
      expect(key.algorithm.name).toBe("AES-GCM");
      expect(key.extractable).toBe(false);
    });

    it("derives different keys from different passphrases with the same salt", async () => {
      const salt = createRandomBase64(16);
      const key1 = await deriveAesKeyFromPassphrase("passphrase-alpha", salt);
      const key2 = await deriveAesKeyFromPassphrase("passphrase-beta", salt);
      const testIv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode("test");
      const ct1 = await crypto.subtle.encrypt({ name: "AES-GCM", iv: testIv }, key1, plaintext);
      const ct2 = await crypto.subtle.encrypt({ name: "AES-GCM", iv: testIv }, key2, plaintext);
      expect(Buffer.from(ct1).toString("hex")).not.toBe(Buffer.from(ct2).toString("hex"));
    });
  });

  describe("encryptJson / decryptJson", () => {
    it("round-trips a JSON value through encrypt then decrypt", async () => {
      const salt = createRandomBase64(16);
      const key = await deriveAesKeyFromPassphrase("test-passphrase-secure", salt);
      const original = { name: "Alice", value: 42, nested: { flag: true } };

      const encrypted = await encryptJson(original, key);

      expect(encrypted.version).toBe(1);
      expect(encrypted.algorithm).toBe("AES-GCM");
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();

      const decrypted = await decryptJson<typeof original>(encrypted, key);
      expect(decrypted).toEqual(original);
    });

    it("encrypts a string marker value and restores it", async () => {
      const salt = createRandomBase64(16);
      const key = await deriveAesKeyFromPassphrase("another-passphrase-long", salt);

      const encrypted = await encryptJson({ marker: "proofvault-session-unlock" }, key);
      const decrypted = await decryptJson<{ marker: string }>(encrypted, key);

      expect(decrypted.marker).toBe("proofvault-session-unlock");
    });

    it("produces different ciphertexts for the same plaintext due to random IV", async () => {
      const salt = createRandomBase64(16);
      const key = await deriveAesKeyFromPassphrase("consistent-passphrase-long", salt);
      const data = { value: "same data" };

      const enc1 = await encryptJson(data, key);
      const enc2 = await encryptJson(data, key);

      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
      expect(enc1.iv).not.toBe(enc2.iv);
    });

    it("throws when decrypting with a wrong key", async () => {
      const salt1 = createRandomBase64(16);
      const salt2 = createRandomBase64(16);
      const key1 = await deriveAesKeyFromPassphrase("passphrase-one-long", salt1);
      const key2 = await deriveAesKeyFromPassphrase("passphrase-two-long", salt2);

      const encrypted = await encryptJson({ secret: "data" }, key1);

      await expect(decryptJson(encrypted, key2)).rejects.toThrow();
    });
  });
});
