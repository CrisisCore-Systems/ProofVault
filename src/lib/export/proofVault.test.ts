import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import {
  buildProofVaultEvidenceManifest,
  buildProofVaultEvidenceRecord,
  createProofVaultRedactionPolicy,
} from "./proofVault";

const baseCase: CaseFile = {
  id: "case-proof-1",
  title: "Administrative hearing prep",
  type: "legal",
  status: "active",
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

function createItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: overrides.id ?? "item-proof-1",
    caseId: overrides.caseId ?? baseCase.id,
    kind: overrides.kind ?? "incident",
    title: overrides.title ?? "Pain flare after stair climb",
    description: overrides.description ?? "Sharp pain radiating down the left leg.",
    occurredAt: overrides.occurredAt ?? "2026-03-03T07:45:00.000Z",
    recordedAt: overrides.recordedAt ?? "2026-03-03T08:00:00.000Z",
    locationText: overrides.locationText ?? "South stairwell",
    peopleInvolved: overrides.peopleInvolved ?? ["Landlord", "Neighbor"],
    tags: overrides.tags ?? ["pain", "mobility"],
    fileRef: overrides.fileRef ?? "att-123",
    originalFilename: overrides.originalFilename ?? "hallway-photo.jpg",
    mimeType: overrides.mimeType ?? "image/jpeg",
    sha256: overrides.sha256 ?? "stored-attachment-hash",
    redactions: overrides.redactions ?? [{ id: "rz-1", x: 12, y: 15, width: 25, height: 10 }],
    includeInExport: overrides.includeInExport ?? true,
    redactionStatus: overrides.redactionStatus ?? "partial",
    dateCertainty: overrides.dateCertainty ?? "exact",
    createdAt: overrides.createdAt ?? "2026-03-03T08:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-03T08:00:00.000Z",
    encryptedPayload:
      overrides.encryptedPayload ??
      ({
        version: 1,
        algorithm: "AES-GCM",
        iv: "iv-123",
        ciphertext: "ciphertext-abc",
      } as const),
  };
}

describe("proofVault export evidence mapping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T16:30:00.000Z"));
  });

  it("records omitted fields for the minimal policy", async () => {
    const item = createItem();
    const policy = createProofVaultRedactionPolicy({
      mode: "redacted",
      includeAttachments: false,
      includeMetadataAppendix: true,
    });

    const record = await buildProofVaultEvidenceRecord({
      item,
      exportTimestamp: "2026-03-10T16:30:00.000Z",
      outputFormat: "pdf",
      redactionPolicy: policy,
    });

    expect(record.exportContext.redactionPolicy.label).toBe("Minimal");
    expect(record.omittedFields).toEqual([
      "attachment",
      "description",
      "encryptedPayload",
      "locationText",
      "originalFilename",
      "peopleInvolved",
      "redactions",
      "sha256",
      "tags",
    ]);
  });

  it("keeps integrity references stable across export formats", async () => {
    const item = createItem();
    const policy = createProofVaultRedactionPolicy({
      mode: "redacted",
      includeAttachments: true,
      includeMetadataAppendix: true,
    });

    const pdfRecord = await buildProofVaultEvidenceRecord({
      item,
      exportTimestamp: "2026-03-10T16:30:00.000Z",
      outputFormat: "pdf",
      redactionPolicy: policy,
    });
    const csvRecord = await buildProofVaultEvidenceRecord({
      item,
      exportTimestamp: "2026-03-10T16:30:00.000Z",
      outputFormat: "csv",
      redactionPolicy: policy,
    });

    expect(pdfRecord.provenance.integrityRef).toBe(csvRecord.provenance.integrityRef);
    expect(pdfRecord.integritySeal).toBe(csvRecord.integritySeal);
    expect(pdfRecord.exportContext.outputFormat).toBe("pdf");
    expect(csvRecord.exportContext.outputFormat).toBe("csv");
  });

  it("builds a manifest with a deterministic top-level seal", async () => {
    const policy = createProofVaultRedactionPolicy({
      mode: "redacted",
      includeAttachments: true,
      includeMetadataAppendix: true,
    });

    const manifest = await buildProofVaultEvidenceManifest({
      caseFile: baseCase,
      items: [createItem({ id: "item-a" }), createItem({ id: "item-b", title: "Second incident" })],
      exportTimestamp: "2026-03-10T16:30:00.000Z",
      outputFormat: "zip",
      redactionPolicy: policy,
    });

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      caseId: baseCase.id,
      exportedAt: "2026-03-10T16:30:00.000Z",
      outputFormat: "zip",
      recordCount: 2,
    });
    expect(manifest.integritySeal).toHaveLength(64);
    expect(manifest.evidenceRecords.every((record) => record.integritySeal.length === 64)).toBe(true);
  });
});