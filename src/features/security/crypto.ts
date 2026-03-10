import type { EncryptedPayload } from "../../domain/types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function createRandomBase64(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64(bytes);
}

export async function deriveAesKeyFromPassphrase(passphrase: string, saltBase64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(base64ToBytes(saltBase64)),
      iterations: 250000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson<T>(value: T, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return {
    version: 1,
    algorithm: "AES-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson<T>(payload: EncryptedPayload, key: CryptoKey): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: payload.algorithm, iv: toArrayBuffer(base64ToBytes(payload.iv)) },
    key,
    toArrayBuffer(base64ToBytes(payload.ciphertext))
  );

  return JSON.parse(textDecoder.decode(new Uint8Array(plaintext))) as T;
}