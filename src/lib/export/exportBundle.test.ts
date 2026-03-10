import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import {
  buildExportPreview,
  buildExportPreviewManifest,
  buildExportPreviewSummary,
  type ExportPacketOptions,
} from "./exportBundle";

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
});