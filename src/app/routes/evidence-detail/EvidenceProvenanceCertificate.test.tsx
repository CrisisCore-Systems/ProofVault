import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidenceProvenanceCertificate } from "./EvidenceProvenanceCertificate";

describe("EvidenceProvenanceCertificate", () => {
  it("renders derivative certificate details", () => {
    const html = renderToStaticMarkup(
      <EvidenceProvenanceCertificate
        evidence={{
          id: "item-1",
          caseId: "case-1",
          kind: "photo",
          title: "Door photo",
          recordedAt: "2026-03-02T10:00:00.000Z",
          includeInExport: true,
          redactionStatus: "partial",
          dateCertainty: "exact",
          originalFilename: "door.jpg",
          mimeType: "image/jpeg",
          sha256: "abc123original",
          createdAt: "2026-03-02T10:00:00.000Z",
          updatedAt: "2026-03-02T10:00:00.000Z",
        }}
        attachment={{
          id: "att-1",
          evidenceItemId: "item-1",
          blob: new Blob(["image"]),
          sizeBytes: 2048,
          mimeType: "image/jpeg",
          originalFilename: "door.jpg",
          createdAt: "2026-03-02T10:00:00.000Z",
        }}
        ledgerEntry={{
          id: "ledger-1",
          timestamp: "2026-03-09T12:00:00.000Z",
          event: "EVIDENCE_REDACTED",
          hash: "chainhash123",
        }}
        certificateImageUrl="blob:certificate"
        derivativeHash="derivedhash456"
        derivativePreparedAt="2026-03-09T12:00:00.000Z"
        isRedactedDerivative={true}
      />
    );

    expect(html).toContain("Evidence Provenance Certificate");
    expect(html).toContain("REDACTED DERIVATIVE COPY");
    expect(html).toContain("Original SHA-256:");
    expect(html).toContain("Derivative SHA-256:");
    expect(html).toContain("chainhash123");
    expect(html).toContain("Flattened Redacted Artifact");
  });
});