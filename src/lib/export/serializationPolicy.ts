import type { AttachmentRecord, EvidenceItem, ExportBundle } from "../../domain/types";
import type { ProofVaultSourceField } from "../../types/proof-vault";

export type ExportSerializationPolicy = {
  id: ExportBundle["mode"];
  label: string;
  mode: ExportBundle["mode"];
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
  omittedFields: ProofVaultSourceField[];
  allowsPeopleInvolved: boolean;
  allowsTags: boolean;
  allowsOriginalFilename: boolean;
  allowsSha256: boolean;
  allowsDescription: boolean;
  allowsLocationText: boolean;
  allowsRedactions: boolean;
  allowsEncryptedPayload: boolean;
};

const REDACTED_POLICY_OMISSIONS: ProofVaultSourceField[] = [
  "originalFilename",
  "peopleInvolved",
  "sha256",
  "tags",
];

const MINIMAL_POLICY_OMISSIONS: ProofVaultSourceField[] = [
  "attachment",
  "description",
  "encryptedPayload",
  "locationText",
  "originalFilename",
  "peopleInvolved",
  "redactions",
  "sha256",
  "tags",
];

function uniqueFields(fields: ProofVaultSourceField[]): ProofVaultSourceField[] {
  return [...new Set(fields)].sort((left, right) => left.localeCompare(right));
}

export function createExportSerializationPolicy(options: {
  mode: ExportBundle["mode"];
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
}): ExportSerializationPolicy {
  if (options.mode === "minimal") {
    return {
      id: "minimal",
      label: "Minimal",
      mode: options.mode,
      includeAttachments: false,
      includeMetadataAppendix: false,
      omittedFields: [...MINIMAL_POLICY_OMISSIONS],
      allowsPeopleInvolved: false,
      allowsTags: false,
      allowsOriginalFilename: false,
      allowsSha256: false,
      allowsDescription: false,
      allowsLocationText: false,
      allowsRedactions: false,
      allowsEncryptedPayload: false,
    };
  }

  if (options.mode === "redacted") {
    return {
      id: "redacted",
      label: "Redacted",
      mode: options.mode,
      includeAttachments: options.includeAttachments,
      includeMetadataAppendix: options.includeMetadataAppendix,
      omittedFields: [...REDACTED_POLICY_OMISSIONS],
      allowsPeopleInvolved: false,
      allowsTags: false,
      allowsOriginalFilename: false,
      allowsSha256: false,
      allowsDescription: true,
      allowsLocationText: true,
      allowsRedactions: true,
      allowsEncryptedPayload: false,
    };
  }

  return {
    id: "full",
    label: "Full",
    mode: options.mode,
    includeAttachments: options.includeAttachments,
    includeMetadataAppendix: options.includeMetadataAppendix,
    omittedFields: [],
    allowsPeopleInvolved: true,
    allowsTags: true,
    allowsOriginalFilename: true,
    allowsSha256: true,
    allowsDescription: true,
    allowsLocationText: true,
    allowsRedactions: true,
    allowsEncryptedPayload: true,
  };
}

export function serializeEvidenceItemForExport(
  item: EvidenceItem,
  policy: ExportSerializationPolicy
): EvidenceItem {
  return {
    ...item,
    description: policy.allowsDescription ? item.description : undefined,
    locationText: policy.allowsLocationText ? item.locationText : undefined,
    peopleInvolved: policy.allowsPeopleInvolved ? item.peopleInvolved : undefined,
    tags: policy.allowsTags ? item.tags : undefined,
    originalFilename: policy.allowsOriginalFilename ? item.originalFilename : undefined,
    sha256: policy.allowsSha256 ? item.sha256 : undefined,
    redactions: policy.allowsRedactions ? item.redactions : undefined,
    encryptedPayload: policy.allowsEncryptedPayload ? item.encryptedPayload : undefined,
  };
}

function extensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    case "audio/mpeg":
      return ".mp3";
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    case "audio/ogg":
      return ".ogg";
    default:
      return "";
  }
}

function stripExistingExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

export function resolveSerializedAttachmentName(input: {
  item: EvidenceItem;
  attachment: AttachmentRecord;
  attachmentMimeType: string;
  policy: ExportSerializationPolicy;
  isRedactedDerivative: boolean;
}): string {
  if (input.policy.allowsOriginalFilename) {
    return input.isRedactedDerivative
      ? `${stripExistingExtension(input.attachment.originalFilename || input.item.originalFilename || input.item.title || input.item.id)}_redacted${extensionFromMimeType(input.attachmentMimeType)}`
      : input.attachment.originalFilename || input.item.originalFilename || input.item.title || input.item.id;
  }

  const suffix = input.isRedactedDerivative ? "_redacted" : "";
  return `attachment_${input.item.id}${suffix}${extensionFromMimeType(input.attachmentMimeType)}`;
}

export function resolveProofPolicyOmissions(
  policy: ExportSerializationPolicy,
  includeAttachments: boolean,
  hasRedactions: boolean
): ProofVaultSourceField[] {
  return uniqueFields([
    ...policy.omittedFields,
    ...(includeAttachments ? [] : (["attachment", "originalFilename", "sha256"] satisfies ProofVaultSourceField[])),
    ...(hasRedactions && policy.mode !== "full" ? (["redactions"] satisfies ProofVaultSourceField[]) : []),
  ]);
}