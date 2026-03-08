export async function sha256HexFromBlob(blob: Blob): Promise<string> {
  const fileBuffer = await blob.arrayBuffer();
  const digestBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
  const digestBytes = new Uint8Array(digestBuffer);

  return Array.from(digestBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256HexFromText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(text);
  const digestBuffer = await crypto.subtle.digest("SHA-256", payloadBytes);
  const digestBytes = new Uint8Array(digestBuffer);

  return Array.from(digestBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
