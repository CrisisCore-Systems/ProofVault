import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidenceItem } from "../../domain/types";
import type { ProofVaultEvidenceManifest } from "../../types/proof-vault";
import type { ProofVaultManifestVerificationResult } from "./proofVerifier";
import {
  buildVerificationReport,
  buildVerificationReportFileName,
  buildVerificationReportFileNameFromMetadata,
} from "./verificationReport";

const backupEvidenceItems: EvidenceItem[] = [
  {
    id: "e1",
    kind: "note",
    title: "Witness note 1",
    recordedAt: "2026-03-13T09:00:00.000Z",
    includeInExport: true,
    redactionStatus: "none",
    dateCertainty: "exact",
    createdAt: "2026-03-13T09:00:00.000Z",
    updatedAt: "2026-03-13T09:00:00.000Z",
  },
  {
    id: "e2",
    kind: "note",
    title: "Witness note 2",
    recordedAt: "2026-03-13T09:05:00.000Z",
    includeInExport: true,
    redactionStatus: "none",
    dateCertainty: "exact",
    createdAt: "2026-03-13T09:05:00.000Z",
    updatedAt: "2026-03-13T09:05:00.000Z",
  },
];

const manifest: ProofVaultEvidenceManifest = {
  schemaVersion: 1,
  caseId: "case-verify-1",
  exportedAt: "2026-03-13T09:15:00.000Z",
  outputFormat: "zip",
  recordCount: 2,
  integritySeal: "a".repeat(64),
  evidenceRecords: [
    {
      sourceId: "item-1",
      provenance: {
        integrityRef: "c".repeat(64),
        encryptedPayloadRef: "d".repeat(64),
        sourceSnapshotRef: "e".repeat(64),
        attachmentRef: "f".repeat(64),
      },
      exportContext: {
        exportTimestamp: "2026-03-13T09:15:00.000Z",
        outputFormat: "zip",
        redactionPolicy: {
          id: "minimal",
          label: "Minimal",
          mode: "redacted",
          omittedFields: ["description", "locationText"],
          includeAttachments: false,
          includeMetadataAppendix: true,
        },
      },
      omittedFields: ["description", "locationText"],
      integritySeal: "b".repeat(64),
    },
  ],
};

const verification: ProofVaultManifestVerificationResult = {
  status: "verified",
  issues: [],
  verified: 2,
  mismatched: 0,
  missing: 0,
  manifestSealValid: true,
  records: [],
};

describe("verificationReport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T12:00:00.000Z"));
  });

  it("builds a machine-readable verification report with a stable checksum", async () => {
    const report = await buildVerificationReport({
      manifest,
      verification,
      verificationSource: "backup-snapshot",
      caseTitle: "Benefits appeal",
      backupSnapshot: {
        snapshotSha256: "b".repeat(64),
        exportedAt: "2026-03-13T10:00:00.000Z",
        evidenceItems: backupEvidenceItems,
      },
    });

    expect(report).toMatchObject({
      format: "proofvault-verification-report",
      version: 1,
      generatedAt: "2026-03-13T12:00:00.000Z",
      status: "verified",
      verificationSource: "backup-snapshot",
      manifest: {
        caseId: manifest.caseId,
        caseTitle: "Benefits appeal",
        integritySeal: manifest.integritySeal,
        redactionPolicy: {
          id: "minimal",
          label: "Minimal",
        },
      },
      sourceSnapshot: {
        backupSnapshotSha256: "b".repeat(64),
        evidenceItemsChecked: 2,
      },
    });
    expect(report.reportSha256).toHaveLength(64);
    expect(report.manifest.redactionPolicy?.translation.omittedFieldLabels).toEqual([
      "Narrative notes",
      "Location details",
    ]);
  });

  it("builds a deterministic file name from the manifest case and date", () => {
    expect(buildVerificationReportFileName(manifest)).toBe("proofvault-verification-case-verify-1-2026-03-13.json");
    expect(
      buildVerificationReportFileNameFromMetadata({
        caseId: manifest.caseId,
        caseTitle: "Benefits appeal",
        exportedAt: manifest.exportedAt,
      })
    ).toBe("proofvault-verification-benefits-appeal-2026-03-13.json");
  });
});