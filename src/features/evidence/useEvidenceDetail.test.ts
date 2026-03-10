import { describe, expect, it } from "vitest";
import type { EvidenceDetailView } from "./evidenceDetailView";
import type { RedactionRegion } from "../../domain/types";
import { deriveEvidenceDetailComputedState } from "./useEvidenceDetail";

const savedRedaction: RedactionRegion = {
  id: "region-1",
  x: 10,
  y: 20,
  width: 30,
  height: 40,
};

const baseView: EvidenceDetailView = {
  evidence: {
    id: "item-1",
    caseId: "case-1",
    kind: "photo",
    title: "Door photo",
    recordedAt: "2026-03-02T10:00:00.000Z",
    includeInExport: true,
    redactionStatus: "partial",
    dateCertainty: "exact",
    redactions: [savedRedaction],
    mimeType: "image/jpeg",
    createdAt: "2026-03-02T10:00:00.000Z",
    updatedAt: "2026-03-02T10:00:00.000Z",
  },
  attachment: {
    id: "att-1",
    evidenceItemId: "item-1",
    blob: new Blob(["image"]),
    sizeBytes: 2048,
    mimeType: "image/jpeg",
    originalFilename: "door.jpg",
    createdAt: "2026-03-02T10:00:00.000Z",
  },
};

describe("useEvidenceDetail helpers", () => {
  it("reports saved derivative certificate state for image evidence with redactions", () => {
    const result = deriveEvidenceDetailComputedState(baseView, [savedRedaction], "blob:original", null);

    expect(result).toEqual({
      hasPendingRedactionChanges: false,
      hasSavedRedactions: true,
      canGenerateDerivativeCertificate: true,
      effectiveCertificateImageUrl: "blob:original",
    });
  });

  it("prefers the prepared certificate image and detects pending redaction changes", () => {
    const result = deriveEvidenceDetailComputedState(
      baseView,
      [...baseView.evidence.redactions!, { ...savedRedaction, id: "region-2" }],
      "blob:original",
      "blob:prepared"
    );

    expect(result.hasPendingRedactionChanges).toBe(true);
    expect(result.effectiveCertificateImageUrl).toBe("blob:prepared");
  });

  it("disables derivative certificates for non-image or unattached evidence", () => {
    const result = deriveEvidenceDetailComputedState(
      {
        evidence: {
          ...baseView.evidence,
          mimeType: "application/pdf",
          redactions: [],
        },
      },
      [],
      null,
      null
    );

    expect(result).toEqual({
      hasPendingRedactionChanges: false,
      hasSavedRedactions: false,
      canGenerateDerivativeCertificate: false,
      effectiveCertificateImageUrl: null,
    });
  });
});