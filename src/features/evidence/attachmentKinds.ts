import type { EvidenceItem } from "../../domain/types";

type AttachmentEvidenceKind = Extract<EvidenceItem["kind"], "photo" | "pdf" | "audio">;

export function isSupportedAttachmentMime(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("audio/");
}

export function inferAttachmentKindFromMime(mimeType: string): AttachmentEvidenceKind {
  if (mimeType.startsWith("image/")) {
    return "photo";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  throw new Error("Unsupported file type. Use image, PDF, or audio files.");
}
