import { describe, expect, it } from "vitest";
import { generateClinicalVerificationCertificateHtml } from "./clinicalReportPdf";
import type { VerificationReport } from "./verificationReport";

const report: VerificationReport = {
  format: "proofvault-verification-report",
  version: 1,
  generatedAt: "2026-03-13T12:00:00.000Z",
  status: "verified",
  verificationSource: "live-vault",
  manifest: {
    caseId: "case-1",
    caseTitle: "Benefits appeal",
    exportedAt: "2026-03-13T10:00:00.000Z",
    outputFormat: "zip",
    recordCount: 2,
    integritySeal: "a".repeat(64),
    redactionPolicy: {
      id: "minimal",
      label: "Minimal",
      mode: "redacted",
      includeAttachments: false,
      includeMetadataAppendix: true,
      omittedFields: ["description", "locationText"],
      translation: {
        heading: "Minimal disclosure policy",
        summary: "This policy minimizes sensitive contextual data while preserving chain-of-custody anchors and the evidence timeline.",
        attachmentHandling: "Attachments were excluded from the export package.",
        metadataAppendixHandling: "The metadata appendix was included to preserve supporting context.",
        omittedFieldLabels: ["Narrative notes", "Location details"],
      },
    },
  },
  sourceSnapshot: {
    backupSnapshotSha256: null,
    backupExportedAt: null,
    evidenceItemsChecked: 2,
  },
  verification: {
    status: "verified",
    issues: [],
    verified: 2,
    mismatched: 0,
    missing: 0,
    manifestSealValid: true,
    records: [],
  },
  reportSha256: "b".repeat(64),
};

describe("clinicalReportPdf", () => {
  it("renders a printable certificate from a verification report", () => {
    const html = generateClinicalVerificationCertificateHtml(report);

    expect(html).toContain("ProofVault Certificate of Integrity");
    expect(html).toContain("Integrity Verified");
    expect(html).toContain("Benefits appeal");
    expect(html).toContain("Manifest seal:");
    expect(html).toContain("Redaction Policy");
    expect(html).toContain("Narrative notes");
    expect(html).toContain("Security Fingerprint");
    expect(html).toContain("AAAA-AAAA-AAAA-AAAA");
    expect(html).toContain("BBBB-BBBB-BBBB-BBBB");
    expect(html).toContain("Report SHA-256:");
  });
});