import { describe, expect, it } from "vitest";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import { buildProofVaultEvidenceManifest, createProofVaultRedactionPolicy } from "./proofVault";
import { parseProofVaultEvidenceManifest, verifyProofVaultEvidenceManifest } from "./proofVerifier";

const baseCase: CaseFile = {
  id: "case-verify-1",
  title: "Benefits appeal",
  type: "medical",
  status: "active",
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

function createItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: overrides.id ?? "item-verify-1",
    caseId: overrides.caseId ?? baseCase.id,
    kind: overrides.kind ?? "incident",
    title: overrides.title ?? "Clinic visit fallout",
    description: overrides.description ?? "Symptoms intensified after travel to clinic.",
    occurredAt: overrides.occurredAt ?? "2026-03-03T07:45:00.000Z",
    recordedAt: overrides.recordedAt ?? "2026-03-03T08:00:00.000Z",
    locationText: overrides.locationText ?? "Clinic parking lot",
    peopleInvolved: overrides.peopleInvolved ?? ["Doctor"],
    tags: overrides.tags ?? ["pain", "appeal"],
    fileRef: overrides.fileRef ?? "att-verify-1",
    originalFilename: overrides.originalFilename ?? "visit-note.jpg",
    mimeType: overrides.mimeType ?? "image/jpeg",
    sha256: overrides.sha256 ?? "attachment-hash-verify",
    redactions: overrides.redactions ?? [{ id: "r1", x: 10, y: 10, width: 20, height: 20 }],
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
        iv: "iv-verify-1",
        ciphertext: "ciphertext-verify-1",
      } as const),
  };
}

describe("proof manifest verifier", () => {
  it("verifies a manifest against the current vault snapshot", async () => {
    const items = [createItem(), createItem({ id: "item-verify-2", title: "Second record" })];
    const manifest = await buildProofVaultEvidenceManifest({
      caseFile: baseCase,
      items,
      exportTimestamp: "2026-03-11T11:00:00.000Z",
      outputFormat: "zip",
      redactionPolicy: createProofVaultRedactionPolicy({
        mode: "redacted",
        includeAttachments: true,
        includeMetadataAppendix: true,
      }),
    });

    const result = await verifyProofVaultEvidenceManifest({
      manifest,
      caseFile: baseCase,
      items,
    });

    expect(result).toMatchObject({
      status: "verified",
      verified: 2,
      mismatched: 0,
      missing: 0,
      manifestSealValid: true,
    });
  });

  it("detects tampered omission claims", async () => {
    const items = [createItem()];
    const manifest = await buildProofVaultEvidenceManifest({
      caseFile: baseCase,
      items,
      exportTimestamp: "2026-03-11T11:00:00.000Z",
      outputFormat: "zip",
      redactionPolicy: createProofVaultRedactionPolicy({
        mode: "redacted",
        includeAttachments: false,
        includeMetadataAppendix: true,
      }),
    });

    manifest.evidenceRecords[0].omittedFields = ["description"];

    const result = await verifyProofVaultEvidenceManifest({
      manifest,
      caseFile: baseCase,
      items,
    });

    expect(result.status).toBe("mismatch");
    expect(result.records[0]).toMatchObject({
      status: "mismatch",
    });
    expect(result.records[0]?.issues).toContain("Omitted field claims do not match the applied redaction policy.");
    expect(result.manifestSealValid).toBe(false);
  });

  it("detects missing vault items referenced by the manifest", async () => {
    const items = [createItem()];
    const manifest = await buildProofVaultEvidenceManifest({
      caseFile: baseCase,
      items,
      exportTimestamp: "2026-03-11T11:00:00.000Z",
      outputFormat: "zip",
      redactionPolicy: createProofVaultRedactionPolicy({
        mode: "redacted",
        includeAttachments: true,
        includeMetadataAppendix: true,
      }),
    });

    const result = await verifyProofVaultEvidenceManifest({
      manifest,
      caseFile: baseCase,
      items: [],
    });

    expect(result.status).toBe("mismatch");
    expect(result.missing).toBe(1);
    expect(result.records[0]).toMatchObject({
      status: "missing",
    });
  });

  it("parses exported manifest JSON and rejects invalid payloads", () => {
    expect(() => parseProofVaultEvidenceManifest("{bad json")).toThrow("Proof manifest is not valid JSON.");

    const parsed = parseProofVaultEvidenceManifest(
      JSON.stringify({
        schemaVersion: 1,
        caseId: "case-verify-1",
        exportedAt: "2026-03-11T11:00:00.000Z",
        outputFormat: "zip",
        recordCount: 0,
        evidenceRecords: [],
        integritySeal: "a".repeat(64),
      })
    );

    expect(parsed.caseId).toBe("case-verify-1");
  });
});