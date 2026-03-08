import type { AttachmentRecord, EvidenceItem } from "../../domain/types";
import { sha256HexFromBlob } from "../../lib/hashing/sha256";

export type IntegrityVerificationResult = {
  status: "verified" | "mismatch" | "unverifiable";
  checkedAt: string;
  details: string;
  recomputedSha256?: string;
};

export type CaseIntegrityItemResult = {
  evidenceId: string;
  title: string;
  kind: EvidenceItem["kind"];
  status: IntegrityVerificationResult["status"] | "skipped";
  details: string;
};

export type CaseIntegrityReport = {
  checkedAt: string;
  total: number;
  changed: number;
  skipped: number;
  verified: number;
  mismatch: number;
  unverifiable: number;
  canUpdateLastVerifiedAt: boolean;
  items: CaseIntegrityItemResult[];
};

function parseIsoToEpoch(isoDate?: string): number | undefined {
  if (!isoDate) {
    return undefined;
  }

  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

export async function verifyEvidenceIntegrity(
  evidence: EvidenceItem,
  attachment?: AttachmentRecord
): Promise<IntegrityVerificationResult> {
  const checkedAt = new Date().toISOString();

  if (!attachment) {
    return {
      status: "unverifiable",
      checkedAt,
      details: "No attachment record is linked to this evidence item.",
    };
  }

  if (!evidence.sha256) {
    return {
      status: "unverifiable",
      checkedAt,
      details: "No stored SHA-256 hash is available for this evidence item.",
    };
  }

  const recomputedSha256 = await sha256HexFromBlob(attachment.blob);
  const hashMatches = recomputedSha256 === evidence.sha256;
  const sizeMatches = attachment.blob.size === attachment.sizeBytes;

  if (hashMatches && sizeMatches) {
    return {
      status: "verified",
      checkedAt,
      details: "Hash and file size match stored integrity metadata.",
      recomputedSha256,
    };
  }

  const mismatchDetails = [
    hashMatches ? null : "SHA-256 mismatch",
    sizeMatches ? null : "File size mismatch",
  ]
    .filter((value): value is string => Boolean(value))
    .join("; ");

  return {
    status: "mismatch",
    checkedAt,
    details: mismatchDetails || "Integrity mismatch detected.",
    recomputedSha256,
  };
}

export async function verifyCaseEvidenceIntegrity(
  evidenceItems: EvidenceItem[],
  getAttachmentForEvidence: (evidenceItem: EvidenceItem) => Promise<AttachmentRecord | undefined>,
  caseLastVerifiedAt?: string
): Promise<CaseIntegrityReport> {
  const checkedAt = new Date().toISOString();
  const caseLastVerifiedEpoch = parseIsoToEpoch(caseLastVerifiedAt);

  const items = await Promise.all(
    evidenceItems.map(async (evidenceItem) => {
      const attachment = await getAttachmentForEvidence(evidenceItem);

      const attachmentLastChangedEpoch = parseIsoToEpoch(attachment?.updatedAt ?? attachment?.createdAt);
      const shouldSkipDueToNoChanges =
        Boolean(attachment) &&
        caseLastVerifiedEpoch !== undefined &&
        attachmentLastChangedEpoch !== undefined &&
        attachmentLastChangedEpoch <= caseLastVerifiedEpoch;

      if (shouldSkipDueToNoChanges) {
        return {
          evidenceId: evidenceItem.id,
          title: evidenceItem.title,
          kind: evidenceItem.kind,
          status: "skipped",
          details: "Skipped: attachment unchanged since last verification.",
        } satisfies CaseIntegrityItemResult;
      }

      const result = await verifyEvidenceIntegrity(evidenceItem, attachment);

      return {
        evidenceId: evidenceItem.id,
        title: evidenceItem.title,
        kind: evidenceItem.kind,
        status: result.status,
        details: result.details,
      } satisfies CaseIntegrityItemResult;
    })
  );

  const changedItems = items.filter((item) => item.status !== "skipped");
  const changedAttachmentItems = changedItems.filter(
    (item) => item.kind === "photo" || item.kind === "pdf" || item.kind === "audio"
  );
  const changedAttachmentFailures = changedAttachmentItems.filter(
    (item) => item.status === "mismatch" || item.status === "unverifiable"
  ).length;

  return {
    checkedAt,
    total: items.length,
    changed: changedItems.length,
    skipped: items.filter((item) => item.status === "skipped").length,
    verified: items.filter((item) => item.status === "verified").length,
    mismatch: items.filter((item) => item.status === "mismatch").length,
    unverifiable: items.filter((item) => item.status === "unverifiable").length,
    canUpdateLastVerifiedAt: changedAttachmentFailures === 0,
    items,
  };
}
