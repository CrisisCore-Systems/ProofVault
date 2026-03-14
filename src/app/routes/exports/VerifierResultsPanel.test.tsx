import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VerifierResultsPanel } from "./VerifierResultsPanel";

describe("VerifierResultsPanel", () => {
  it("renders empty state without a proof manifest", () => {
    const html = renderToStaticMarkup(
      <VerifierResultsPanel
        manifest={null}
        verification={null}
        verificationReport={null}
        verifying={false}
        onDownloadReport={() => {}}
        onPrintCertificate={() => {}}
      />
    );

    expect(html).toContain("Choose a case to inspect the proof manifest preview.");
  });

  it("renders verification results and findings", () => {
    const html = renderToStaticMarkup(
      <VerifierResultsPanel
        manifest={{
          schemaVersion: 1,
          caseId: "case-1",
          exportedAt: "2026-03-12T09:00:00.000Z",
          outputFormat: "zip",
          recordCount: 2,
          integritySeal: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          evidenceRecords: [
            {
              sourceId: "item-1",
              provenance: {
                integrityRef: "a".repeat(64),
                encryptedPayloadRef: "b".repeat(64),
                sourceSnapshotRef: "c".repeat(64),
                attachmentRef: "d".repeat(64),
              },
              exportContext: {
                exportTimestamp: "2026-03-12T09:00:00.000Z",
                outputFormat: "zip",
                redactionPolicy: {
                  id: "minimal",
                  label: "Minimal",
                  mode: "redacted",
                  omittedFields: ["description", "peopleInvolved"],
                  includeAttachments: false,
                  includeMetadataAppendix: true,
                },
              },
              omittedFields: ["description", "peopleInvolved"],
              integritySeal: "e".repeat(64),
            },
          ],
        }}
        verification={{
          status: "mismatch",
          issues: ["Manifest integrity seal does not match the embedded evidence records."],
          verified: 1,
          mismatched: 1,
          missing: 0,
          manifestSealValid: false,
          records: [
            {
              sourceId: "item-1",
              status: "mismatch",
              issues: ["Omitted field claims do not match the applied redaction policy."],
            },
          ],
        }}
        verificationReport={{
          format: "proofvault-verification-report",
          version: 1,
          generatedAt: "2026-03-12T09:05:00.000Z",
          status: "mismatch",
          verificationSource: "live-vault",
          manifest: {
            caseId: "case-1",
            caseTitle: "Case 1",
            exportedAt: "2026-03-12T09:00:00.000Z",
            outputFormat: "zip",
            recordCount: 2,
            integritySeal: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            redactionPolicy: {
              id: "minimal",
              label: "Minimal",
              mode: "redacted",
              includeAttachments: false,
              includeMetadataAppendix: true,
              omittedFields: ["description", "peopleInvolved"],
              translation: {
                heading: "Minimal disclosure policy",
                summary: "This policy minimizes sensitive contextual data while preserving chain-of-custody anchors and the evidence timeline.",
                attachmentHandling: "Attachments were excluded from the export package.",
                metadataAppendixHandling: "The metadata appendix was included to preserve supporting context.",
                omittedFieldLabels: ["Narrative notes", "Names of people involved"],
              },
            },
          },
          sourceSnapshot: {
            backupSnapshotSha256: null,
            backupExportedAt: null,
            evidenceItemsChecked: 2,
          },
          verification: {
            status: "mismatch",
            issues: ["Manifest integrity seal does not match the embedded evidence records."],
            verified: 1,
            mismatched: 1,
            missing: 0,
            manifestSealValid: false,
            records: [
              {
                sourceId: "item-1",
                status: "mismatch",
                issues: ["Omitted field claims do not match the applied redaction policy."],
              },
            ],
          },
          reportSha256: "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
        }}
        verifying={false}
        onDownloadReport={() => {}}
        onPrintCertificate={() => {}}
      />
    );

    expect(html).toContain("Proof verifier");
    expect(html).toContain("Issues found");
    expect(html).toContain("Mismatched: 1");
    expect(html).toContain("Seal: invalid");
    expect(html).toContain("item-1");
    expect(html).toContain("Omitted field claims do not match the applied redaction policy.");
    expect(html).toContain("Minimal disclosure policy");
    expect(html).toContain("Narrative notes");
    expect(html).toContain("Names of people involved");
    expect(html).toContain("Security fingerprint");
    expect(html).toContain("1234-5678-90AB-CDEF");
    expect(html).toContain("FEDC-BA09-8765-4321");
    expect(html).toContain("Print Clinical Certificate");
    expect(html).toContain("Download Verification Report");
  });
});