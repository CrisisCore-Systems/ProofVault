import type { BackupVerificationSnapshot } from "../../features/security/backup";
import { sha256HexFromText } from "../hashing/sha256";
import { downloadTextFile } from "../utils/download";
import type { ProofVaultManifestVerificationResult } from "./proofVerifier";
import { translateProofVaultRedactionPolicy, type ProofVaultPolicyTranslation } from "./policyTranslator";
import type { ProofVaultEvidenceManifest, ProofVaultRedactionPolicy } from "../../types/proof-vault";

export type VerificationReport = {
  format: "proofvault-verification-report";
  version: 1;
  generatedAt: string;
  status: "verified" | "mismatch";
  verificationSource: "live-vault" | "backup-snapshot";
  manifest: {
    caseId: string;
    caseTitle: string | null;
    exportedAt: string;
    outputFormat: ProofVaultEvidenceManifest["outputFormat"];
    recordCount: number;
    integritySeal: string;
    redactionPolicy: {
      id: ProofVaultRedactionPolicy["id"];
      label: string;
      mode: ProofVaultRedactionPolicy["mode"];
      includeAttachments: boolean;
      includeMetadataAppendix: boolean;
      omittedFields: ProofVaultRedactionPolicy["omittedFields"];
      translation: ProofVaultPolicyTranslation;
    } | null;
  };
  sourceSnapshot: {
    backupSnapshotSha256: string | null;
    backupExportedAt: string | null;
    evidenceItemsChecked: number;
  };
  verification: ProofVaultManifestVerificationResult;
  reportSha256: string;
};

type VerificationReportInput = {
  manifest: ProofVaultEvidenceManifest;
  caseTitle?: string;
  verification: ProofVaultManifestVerificationResult;
  verificationSource: VerificationReport["verificationSource"];
  generatedAt?: string;
  backupSnapshot?: Pick<BackupVerificationSnapshot, "snapshotSha256" | "exportedAt" | "evidenceItems">;
};

function resolveManifestRedactionPolicy(manifest: ProofVaultEvidenceManifest): ProofVaultRedactionPolicy | null {
  const firstRecord = manifest.evidenceRecords[0];
  return firstRecord?.exportContext.redactionPolicy ?? null;
}

function sanitizeFileSegment(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return sanitized.length > 0 ? sanitized : "verification";
}

export function buildVerificationReportFileName(manifest: ProofVaultEvidenceManifest): string {
  return `proofvault-verification-${sanitizeFileSegment(manifest.caseId)}-${manifest.exportedAt.slice(0, 10)}.json`;
}

export function buildVerificationReportFileNameFromMetadata(input: {
  caseId: string;
  caseTitle?: string | null;
  exportedAt: string;
}): string {
  const label = input.caseTitle ? sanitizeFileSegment(input.caseTitle) : sanitizeFileSegment(input.caseId);
  return `proofvault-verification-${label}-${input.exportedAt.slice(0, 10)}.json`;
}

export async function buildVerificationReport(input: VerificationReportInput): Promise<VerificationReport> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const payload = {
    format: "proofvault-verification-report" as const,
    version: 1 as const,
    generatedAt,
    status: input.verification.status,
    verificationSource: input.verificationSource,
    manifest: {
      caseId: input.manifest.caseId,
      caseTitle: input.caseTitle ?? null,
      exportedAt: input.manifest.exportedAt,
      outputFormat: input.manifest.outputFormat,
      recordCount: input.manifest.recordCount,
      integritySeal: input.manifest.integritySeal,
      redactionPolicy: (() => {
        const policy = resolveManifestRedactionPolicy(input.manifest);
        const translation = translateProofVaultRedactionPolicy(policy);

        if (!policy || !translation) {
          return null;
        }

        return {
          id: policy.id,
          label: policy.label,
          mode: policy.mode,
          includeAttachments: policy.includeAttachments,
          includeMetadataAppendix: policy.includeMetadataAppendix,
          omittedFields: policy.omittedFields,
          translation,
        };
      })(),
    },
    sourceSnapshot: {
      backupSnapshotSha256: input.backupSnapshot?.snapshotSha256 ?? null,
      backupExportedAt: input.backupSnapshot?.exportedAt ?? null,
      evidenceItemsChecked: input.backupSnapshot?.evidenceItems.length ?? input.manifest.recordCount,
    },
    verification: input.verification,
  };

  const reportSha256 = await sha256HexFromText(JSON.stringify(payload));

  return {
    ...payload,
    reportSha256,
  };
}

export async function downloadVerificationReport(input: VerificationReportInput): Promise<string> {
  const report = await buildVerificationReport(input);
  const fileName = buildVerificationReportFileNameFromMetadata({
    caseId: input.manifest.caseId,
    caseTitle: input.caseTitle,
    exportedAt: input.manifest.exportedAt,
  });

  downloadTextFile(fileName, JSON.stringify(report, null, 2), "application/json;charset=utf-8");

  return fileName;
}