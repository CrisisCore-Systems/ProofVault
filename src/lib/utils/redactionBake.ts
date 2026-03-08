import type { RedactionRegion } from "../../domain/types";
import { sha256HexFromBlob } from "../hashing/sha256";

type RedactionBakeResult = {
  bakedBlob: Blob;
  bakedHash: string;
};

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to load image for redaction bake"));
    };

    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode redacted derivative"));
        return;
      }

      resolve(blob);
    }, mimeType);
  });
}

export async function bakeRedactedImage(
  originalBlob: Blob,
  redactions: RedactionRegion[]
): Promise<RedactionBakeResult> {
  const image = await loadImageFromBlob(originalBlob);

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering context is unavailable");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";

  for (const region of redactions) {
    const x = (region.x / 100) * canvas.width;
    const y = (region.y / 100) * canvas.height;
    const width = (region.width / 100) * canvas.width;
    const height = (region.height / 100) * canvas.height;
    context.fillRect(x, y, width, height);
  }

  const bakedBlob = await canvasToBlob(canvas, "image/png");
  const bakedHash = await sha256HexFromBlob(bakedBlob);

  return { bakedBlob, bakedHash };
}
