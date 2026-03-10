import type { ExportPacketOptions } from "../../lib/export/exportBundle";
import { buildExportPreviewManifest, buildExportPreviewSummary } from "../../lib/export/exportBundle";
import { downloadTextFile } from "../../lib/utils/download";

type ExportPreflightActionResult = {
  message: string;
};

function buildManifestPreviewFileName(caseTitle: string): string {
  const safeName = caseTitle
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return `${safeName || "case"}-manifest-preview.json`;
}

export async function copyExportPreviewSummary(
  options: ExportPacketOptions
): Promise<ExportPreflightActionResult> {
  try {
    const summary = buildExportPreviewSummary(options);
    await globalThis.navigator.clipboard.writeText(summary);

    return { message: "Export summary copied to clipboard." };
  } catch {
    return { message: "Unable to copy summary to clipboard on this device." };
  }
}

export function downloadExportPreviewManifest(
  options: ExportPacketOptions
): ExportPreflightActionResult {
  const manifest = buildExportPreviewManifest(options);

  downloadTextFile(
    buildManifestPreviewFileName(options.caseFile.title),
    JSON.stringify(manifest, null, 2),
    "application/json;charset=utf-8"
  );

  return { message: "Manifest preview downloaded." };
}