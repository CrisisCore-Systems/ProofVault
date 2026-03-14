import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import { appendLedgerEvent } from "../../features/ledger/chain";
import { listLedgerEntries, upsertExportBundle } from "../../db/queries";
import { downloadBlobFile } from "../utils/download";
import {
  buildExportPreview,
  buildExportPreviewManifest,
  buildExportPreviewSummary,
  generateExportPacket,
  type ExportPacketOptions,
} from "./exportBundle";

vi.mock("../../db/queries", () => ({
  getHydratedAttachmentByEvidenceItemId: vi.fn(),
  listLedgerEntries: vi.fn(),
  upsertExportBundle: vi.fn(),
}));

vi.mock("../../features/ledger/chain", () => ({
  appendLedgerEvent: vi.fn(),
}));

vi.mock("../utils/download", () => ({
  downloadBlobFile: vi.fn(),
}));

const baseCase: CaseFile = {
  id: "case-1",
  title: "Tenant Harassment Log",
  type: "housing",
  status: "active",
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

function createItem(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: overrides.id ?? "item-1",
    caseId: overrides.caseId ?? baseCase.id,
    kind: overrides.kind ?? "note",
    title: overrides.title ?? "Untitled item",
    occurredAt: overrides.occurredAt,
    recordedAt: overrides.recordedAt ?? "2026-03-02T10:00:00.000Z",
    includeInExport: overrides.includeInExport ?? true,
    redactionStatus: overrides.redactionStatus ?? "none",
    dateCertainty: overrides.dateCertainty ?? "exact",
    fileRef: overrides.fileRef,
    mimeType: overrides.mimeType,
    originalFilename: overrides.originalFilename,
    redactions: overrides.redactions,
    createdAt: overrides.createdAt ?? "2026-03-02T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-02T10:00:00.000Z",
    description: overrides.description,
    importedAt: overrides.importedAt,
    locationText: overrides.locationText,
    peopleInvolved: overrides.peopleInvolved,
    tags: overrides.tags,
    sha256: overrides.sha256,
    encryptedPayload: overrides.encryptedPayload,
  };
}

function createOptions(overrides?: Partial<ExportPacketOptions>): ExportPacketOptions {
  return {
    caseFile: overrides?.caseFile ?? baseCase,
    items: overrides?.items ?? [],
    mode: overrides?.mode ?? "redacted",
    startDate: overrides?.startDate,
    endDate: overrides?.endDate,
    includeAttachments: overrides?.includeAttachments ?? true,
    includeMetadataAppendix: overrides?.includeMetadataAppendix ?? true,
  };
}

describe("export preview helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
    vi.mocked(listLedgerEntries).mockResolvedValue([]);
    vi.mocked(upsertExportBundle).mockResolvedValue(undefined);
    vi.mocked(appendLedgerEvent).mockResolvedValue(undefined);
    vi.mocked(downloadBlobFile).mockReset();
  });

  it("builds preview items in timeline order with inclusion and attachment reasoning", () => {
    const items = [
      createItem({
        id: "outside-range",
        title: "Older screenshot",
        kind: "screenshot",
        recordedAt: "2026-03-01T08:00:00.000Z",
        fileRef: "att-1",
        mimeType: "image/png",
      }),
      createItem({
        id: "partial-image",
        title: "Marked-up hallway photo",
        kind: "photo",
        recordedAt: "2026-03-03T10:00:00.000Z",
        fileRef: "att-2",
        mimeType: "image/jpeg",
        redactionStatus: "partial",
        redactions: [{ id: "r1", x: 1, y: 1, width: 10, height: 10 }],
      }),
      createItem({
        id: "manual-exclude",
        title: "Internal note",
        includeInExport: false,
        recordedAt: "2026-03-04T10:00:00.000Z",
      }),
      createItem({
        id: "partial-pdf",
        title: "Lease excerpt",
        kind: "pdf",
        recordedAt: "2026-03-05T10:00:00.000Z",
        fileRef: "att-3",
        mimeType: "application/pdf",
        redactionStatus: "partial",
        redactions: [{ id: "r2", x: 2, y: 2, width: 20, height: 20 }],
      }),
    ];

    const preview = buildExportPreview(
      createOptions({
        items,
        startDate: "2026-03-02",
        endDate: "2026-03-05",
      })
    );

    expect(preview.map((item) => item.id)).toEqual([
      "outside-range",
      "partial-image",
      "manual-exclude",
      "partial-pdf",
    ]);

    expect(preview[0]).toMatchObject({
      included: false,
      selectionReason: "Item falls outside the selected date range.",
      attachmentDisposition: "included",
    });

    expect(preview[1]).toMatchObject({
      included: true,
      attachmentDisposition: "included",
      attachmentReason: "Image attachment will be exported as a baked redacted derivative.",
    });

    expect(preview[2]).toMatchObject({
      included: false,
      selectionReason: "Item is currently excluded from export.",
      attachmentDisposition: "not-applicable",
    });

    expect(preview[3]).toMatchObject({
      included: true,
      attachmentDisposition: "omitted",
      attachmentReason: "Non-image attachment with redactions cannot be exported in redacted mode.",
    });
  });

  it("builds a manifest preview with stable counts and option metadata", () => {
    const items = [
      createItem({ id: "included-image", title: "Photo", kind: "photo", fileRef: "att-1", mimeType: "image/png" }),
      createItem({ id: "omitted-full", title: "Fully redacted audio", kind: "audio", fileRef: "att-2", mimeType: "audio/mpeg", redactionStatus: "full" }),
      createItem({ id: "plain-note", title: "Witness note", includeInExport: false }),
    ];

    const manifest = buildExportPreviewManifest(
      createOptions({
        items,
        includeAttachments: true,
        includeMetadataAppendix: false,
        mode: "redacted",
        startDate: "2026-03-02",
        endDate: "2026-03-31",
      })
    );

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      preview: true,
      case: {
        id: baseCase.id,
        title: baseCase.title,
        type: baseCase.type,
        status: baseCase.status,
      },
      options: {
        mode: "redacted",
        includeAttachments: true,
        includeMetadataAppendix: false,
        startDate: "2026-03-02",
        endDate: "2026-03-31",
      },
      counts: {
        totalItems: 3,
        includedItems: 2,
        excludedItems: 1,
        attachmentsIncluded: 1,
        attachmentsOmitted: 1,
        itemsWithoutAttachments: 1,
      },
    });

    expect(manifest.generatedAt).toBe("2026-03-09T12:00:00.000Z");
    expect(manifest.items).toHaveLength(3);
  });

  it("builds a readable summary with included and excluded sections", () => {
    const items = [
      createItem({ id: "include-1", title: "Door photo", kind: "photo", fileRef: "att-1", mimeType: "image/png" }),
      createItem({ id: "exclude-1", title: "Private draft", includeInExport: false }),
    ];

    const summary = buildExportPreviewSummary(
      createOptions({
        items,
        mode: "full",
        includeAttachments: false,
        includeMetadataAppendix: true,
      })
    );

    expect(summary).toContain("ProofVault Export Preview");
    expect(summary).toContain(`Case: ${baseCase.title}`);
    expect(summary).toContain("Mode: full");
    expect(summary).toContain("Include Attachments: no");
    expect(summary).toContain("Include Metadata Appendix: yes");
    expect(summary).toContain("Included:");
    expect(summary).toContain("- Door photo (photo) — Attachments excluded by current export settings.");
    expect(summary).toContain("Excluded:");
    expect(summary).toContain("- Private draft (note) — Item is currently excluded from export.");
  });

  it("includes a root fingerprint dog-tag file in generated export archives", async () => {
    vi.useRealTimers();

    const items = [
      createItem({
        id: "note-1",
        title: "Witness note",
        description: "Observed damage near the front entrance.",
        tags: ["witness", "entryway"],
        peopleInvolved: ["A. Rivera"],
        recordedAt: "2026-03-08T15:30:00.000Z",
      }),
    ];

    await generateExportPacket(
      createOptions({
        items,
        mode: "redacted",
        includeAttachments: false,
        includeMetadataAppendix: false,
      })
    );

    expect(downloadBlobFile).toHaveBeenCalledTimes(1);
    const [, archiveBlob] = vi.mocked(downloadBlobFile).mock.calls[0];
    const archiveBuffer = await archiveBlob.arrayBuffer();
    const archive = await JSZip.loadAsync(archiveBuffer);
    const fingerprintFile = archive.file("FINGERPRINT.txt");
    const proofFile = archive.file("proof-vault-evidence.json");
    const manifestFileName = Object.keys(archive.files).find(
      (fileName) => fileName.startsWith("manifest-") && fileName.endsWith(".json")
    );
    const manifestFile = archive.file(manifestFileName);

    expect(fingerprintFile).toBeTruthy();
    expect(proofFile).toBeTruthy();
    expect(manifestFile).toBeTruthy();

    const fingerprintText = await fingerprintFile!.async("string");
    const proofManifest = JSON.parse(await proofFile!.async("string")) as { integritySeal: string };
    const exportManifest = JSON.parse(await manifestFile!.async("string")) as { files: Record<string, string> };

    expect(fingerprintText).toContain("ProofVault Export Fingerprint");
    expect(fingerprintText).toContain(`Case: ${baseCase.title}`);
    expect(fingerprintText).toContain("Proof Manifest: proof-vault-evidence.json");
    expect(fingerprintText).toContain(`Manifest Seal SHA-256: ${proofManifest.integritySeal}`);
    expect(fingerprintText).toMatch(/Manifest Fingerprint: [A-F0-9]{4}(?:-[A-F0-9]{4}){3}/);
    expect(exportManifest.files.fingerprint).toBe("FINGERPRINT.txt");
    expect(exportManifest.files.evidenceProof).toBe("proof-vault-evidence.json");
  });
});