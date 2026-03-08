import type { AttachmentRecord, EvidenceItem } from "../../domain/types";
import { createAttachmentAndEvidenceItem } from "../../db/queries";
import { appendLedgerEvent } from "../ledger/chain";
import { sha256HexFromBlob } from "../../lib/hashing/sha256";
import { inferAttachmentKindFromMime, isSupportedAttachmentMime } from "./attachmentKinds";
import type { AttachmentFormValues } from "./attachmentValidators";
import { validateAttachmentForm } from "./attachmentValidators";
import { encryptBlob } from "../../lib/crypto/aes";

function toIsoFromLocalDateTime(value: string): string {
  return new Date(value).toISOString();
}

export async function saveAttachment(
  values: AttachmentFormValues,
  selectedFile: File,
  encryptionKey?: CryptoKey | null
): Promise<{ evidenceItemId: string; attachmentId: string }> {
  const result = validateAttachmentForm(values);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid attachment input");
  }

  if (!selectedFile) {
    throw new Error("A file is required");
  }

  if (selectedFile.size === 0) {
    throw new Error("Cannot import empty file");
  }

  if (!isSupportedAttachmentMime(selectedFile.type)) {
    throw new Error("Unsupported file type. Use image, PDF, or audio files.");
  }

  const kind = inferAttachmentKindFromMime(selectedFile.type);
  const nowIso = new Date().toISOString();
  const evidenceItemId = crypto.randomUUID();
  const attachmentId = crypto.randomUUID();

  const digest = await sha256HexFromBlob(selectedFile);

  let storedBlob: Blob = selectedFile;
  let encrypted: boolean | undefined;
  let encryptionIv: Uint8Array | undefined;

  if (encryptionKey) {
    const result = await encryptBlob(selectedFile, encryptionKey);
    storedBlob = new Blob([result.ciphertext]);
    encrypted = true;
    encryptionIv = result.iv;
  }

  const attachmentRecord: AttachmentRecord = {
    id: attachmentId,
    evidenceItemId,
    blob: storedBlob,
    sizeBytes: selectedFile.size,
    mimeType: selectedFile.type,
    originalFilename: selectedFile.name,
    createdAt: nowIso,
    updatedAt: nowIso,
    encrypted,
    encryptionIv,
  };

  const evidenceItem: EvidenceItem = {
    id: evidenceItemId,
    caseId: values.caseId || undefined,
    kind,
    title: values.title.trim(),
    description: values.description?.trim() || undefined,
    occurredAt: undefined,
    recordedAt: values.recordedAt ? toIsoFromLocalDateTime(values.recordedAt) : nowIso,
    importedAt: nowIso,
    locationText: undefined,
    peopleInvolved: undefined,
    tags: undefined,
    fileRef: attachmentId,
    originalFilename: selectedFile.name,
    mimeType: selectedFile.type,
    sha256: digest,
    includeInExport: true,
    redactionStatus: "none",
    dateCertainty: "unknown",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await createAttachmentAndEvidenceItem(attachmentRecord, evidenceItem);

  await appendLedgerEvent({
    event: "ATTACHMENT_ADDED",
    caseId: evidenceItem.caseId,
    attachmentId,
    data: {
      evidenceItemId,
      originalFilename: selectedFile.name,
      mimeType: selectedFile.type,
      sizeBytes: selectedFile.size,
      encrypted: encrypted ?? false,
    },
  });

  await appendLedgerEvent({
    event: "ATTACHMENT_HASH_COMPUTED",
    caseId: evidenceItem.caseId,
    attachmentId,
    data: {
      evidenceItemId,
      sha256: digest,
    },
  });

  return { evidenceItemId, attachmentId };
}

