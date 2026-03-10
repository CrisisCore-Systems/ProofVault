import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import type { ExportPacketOptions } from "../../lib/export/exportBundle";
import { copyExportPreviewSummary, downloadExportPreviewManifest } from "./preflight";

const {
  buildExportPreviewSummaryMock,
  buildExportPreviewManifestMock,
  downloadTextFileMock,
} = vi.hoisted(() => ({
  buildExportPreviewSummaryMock: vi.fn(),
  buildExportPreviewManifestMock: vi.fn(),
  downloadTextFileMock: vi.fn(),
}));

vi.mock("../../lib/export/exportBundle", () => ({
  buildExportPreviewSummary: buildExportPreviewSummaryMock,
  buildExportPreviewManifest: buildExportPreviewManifestMock,
}));

vi.mock("../../lib/utils/download", () => ({
  downloadTextFile: downloadTextFileMock,
}));

const baseCase: CaseFile = {
  id: "case-1",
  title: "Tenant Harassment Log",
  type: "housing",
  status: "active",
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

const baseItem: EvidenceItem = {
  id: "item-1",
  caseId: "case-1",
  kind: "note",
  title: "Witness note",
  recordedAt: "2026-03-02T10:00:00.000Z",
  includeInExport: true,
  redactionStatus: "none",
  dateCertainty: "exact",
  createdAt: "2026-03-02T10:00:00.000Z",
  updatedAt: "2026-03-02T10:00:00.000Z",
};

function createOptions(overrides?: Partial<ExportPacketOptions>): ExportPacketOptions {
  return {
    caseFile: overrides?.caseFile ?? baseCase,
    items: overrides?.items ?? [baseItem],
    mode: overrides?.mode ?? "redacted",
    startDate: overrides?.startDate,
    endDate: overrides?.endDate,
    includeAttachments: overrides?.includeAttachments ?? true,
    includeMetadataAppendix: overrides?.includeMetadataAppendix ?? true,
  };
}

describe("export preflight helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: vi.fn(),
        },
      },
      configurable: true,
    });
  });

  it("copies the generated summary to the clipboard", async () => {
    buildExportPreviewSummaryMock.mockReturnValue("preview text");

    const result = await copyExportPreviewSummary(createOptions());

    expect(buildExportPreviewSummaryMock).toHaveBeenCalledTimes(1);
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith("preview text");
    expect(result).toEqual({ message: "Export summary copied to clipboard." });
  });

  it("returns a graceful message when clipboard copy fails", async () => {
    buildExportPreviewSummaryMock.mockReturnValue("preview text");
    vi.mocked(globalThis.navigator.clipboard.writeText).mockRejectedValueOnce(new Error("blocked"));

    const result = await copyExportPreviewSummary(createOptions());

    expect(result).toEqual({ message: "Unable to copy summary to clipboard on this device." });
  });

  it("downloads the manifest preview with a sanitized file name", () => {
    buildExportPreviewManifestMock.mockReturnValue({ schemaVersion: 1, preview: true });

    const result = downloadExportPreviewManifest(
      createOptions({
        caseFile: {
          ...baseCase,
          title: "  Tenant / Harassment: Log  ",
        },
      })
    );

    expect(buildExportPreviewManifestMock).toHaveBeenCalledTimes(1);
    expect(downloadTextFileMock).toHaveBeenCalledWith(
      "tenant-harassment-log-manifest-preview.json",
      JSON.stringify({ schemaVersion: 1, preview: true }, null, 2),
      "application/json;charset=utf-8"
    );
    expect(result).toEqual({ message: "Manifest preview downloaded." });
  });
});