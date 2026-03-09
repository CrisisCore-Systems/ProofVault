import { encryptBlob, decryptBlob } from "./aes";

export const PBKDF2_ITERATIONS = 250_000;
const VERIFIER_MIME = "text/plain";
const VERIFIER_PLAINTEXT = "proofvault-key-check-v1";

export async function generateSalt(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  const baseKey = await crypto.subtle.importKey("raw", passphraseBytes, "PBKDF2", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function createVerifier(
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const verifierBlob = new Blob([VERIFIER_PLAINTEXT], { type: VERIFIER_MIME });
  return encryptBlob(verifierBlob, key);
}

export async function checkVerifier(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array
): Promise<boolean> {
  try {
    const decrypted = await decryptBlob(ciphertext, iv, VERIFIER_MIME, key);
    const text = await decrypted.text();
    return text === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
