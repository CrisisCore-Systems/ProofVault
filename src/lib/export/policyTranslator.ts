import type { ProofVaultRedactionPolicy, ProofVaultSourceField } from "../../types/proof-vault";

export type ProofVaultPolicyTranslation = {
  heading: string;
  summary: string;
  attachmentHandling: string;
  metadataAppendixHandling: string;
  omittedFieldLabels: string[];
};

const SOURCE_FIELD_LABELS: Record<ProofVaultSourceField, string> = {
  attachment: "Attachment files",
  description: "Narrative notes",
  encryptedPayload: "Encrypted sensitive payload",
  locationText: "Location details",
  occurredAt: "Occurrence timestamp",
  originalFilename: "Original file names",
  peopleInvolved: "Names of people involved",
  redactions: "Redaction geometry details",
  sha256: "Attachment hash values",
  tags: "Tags and categorization labels",
};

function attachmentHandling(policy: ProofVaultRedactionPolicy): string {
  if (!policy.includeAttachments) {
    return "Attachments were excluded from the export package.";
  }

  if (policy.mode === "redacted") {
    return "Attachments were included only when consistent with the selected redaction settings.";
  }

  return "Attachments were included in full.";
}

function metadataAppendixHandling(policy: ProofVaultRedactionPolicy): string {
  return policy.includeMetadataAppendix
    ? "The metadata appendix was included to preserve supporting context."
    : "The metadata appendix was omitted from this export.";
}

function summary(policy: ProofVaultRedactionPolicy): string {
  if (policy.id === "minimal") {
    return "This policy minimizes sensitive contextual data while preserving chain-of-custody anchors and the evidence timeline.";
  }

  return "This policy preserves the full export context without policy-driven field omissions.";
}

export function translateProofVaultRedactionPolicy(
  policy: ProofVaultRedactionPolicy | null
): ProofVaultPolicyTranslation | null {
  if (!policy) {
    return null;
  }

  return {
    heading: `${policy.label} disclosure policy`,
    summary: summary(policy),
    attachmentHandling: attachmentHandling(policy),
    metadataAppendixHandling: metadataAppendixHandling(policy),
    omittedFieldLabels: policy.omittedFields.map((field) => SOURCE_FIELD_LABELS[field]),
  };
}