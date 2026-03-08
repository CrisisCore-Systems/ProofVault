const AES_ALGORITHM = "AES-GCM";
const IV_LENGTH_BYTES = 12;

export async function encryptBlob(
  blob: Blob,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const plaintext = await blob.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: AES_ALGORITHM, iv }, key, plaintext);
  return { ciphertext, iv };
}

export async function decryptBlob(
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
  mimeType: string,
  key: CryptoKey
): Promise<Blob> {
  const plaintext = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: iv as Uint8Array<ArrayBuffer> },
    key,
    ciphertext
  );
  return new Blob([plaintext], { type: mimeType });
}
