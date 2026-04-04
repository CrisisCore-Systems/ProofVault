import type { CaseFile, EvidenceItem } from "../../domain/types";
import type { TimelineEvent } from "../../features/cases/timeline";
import { formatDisplayDateTime } from "../dates/format";

export type CaseReportEvidenceMeta = {
  evidence: EvidenceItem;
  sizeBytes?: number;
  mimeType?: string;
  sha256?: string;
  isRedactedDerivative?: boolean;
  originalSha256?: string;
};

function formatSize(sizeBytes?: number): string {
  if (!sizeBytes || sizeBytes < 0) {
    return "-";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const kib = sizeBytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }

  return `${(kib / 1024).toFixed(1)} MB`;
}

function timelineLine(event: TimelineEvent): string {
  return `### ${formatDisplayDateTime(event.timestamp)}\n${event.title}\n`;
}

function evidenceIndexLine(index: number, meta: CaseReportEvidenceMeta): string {
  const { evidence } = meta;
  const itemLabel = evidence.originalFilename ?? evidence.title;
  const mimeType = meta.mimeType ?? evidence.mimeType ?? "-";
  const sha256 = meta.sha256 ?? evidence.sha256 ?? "-";

  if (meta.isRedactedDerivative) {
    return [
      `${index}. ${itemLabel} **[REDACTED DERIVATIVE]**`,
      `   MIME: ${mimeType}`,
      `   Size: ${formatSize(meta.sizeBytes)}`,
      `   Derivative SHA256: ${sha256}`,
      `   Original SHA256: ${meta.originalSha256 ?? evidence.sha256 ?? "-"}`,
      `   derivative_of: ${meta.originalSha256 ?? evidence.sha256 ?? "-"}`,
    ].join("\n");
  }

  return [
    `${index}. ${itemLabel}`,
    `   Type: ${evidence.kind}`,
    `   MIME: ${mimeType}`,
    `   Size: ${formatSize(meta.sizeBytes)}`,
    ...(sha256 === "-" ? [] : [`   SHA256: ${sha256}`]),
  ].join("\n");
}

export function generateCaseReportMarkdown(
  caseFile: CaseFile,
  timelineEvents: TimelineEvent[],
  evidenceMeta: CaseReportEvidenceMeta[]
): string {
  const createdLine = caseFile.createdAt ? formatDisplayDateTime(caseFile.createdAt) : "-";

  const timelineSection =
    timelineEvents.length > 0
      ? timelineEvents.map((event) => timelineLine(event)).join("\n")
      : "No timeline events available.\n";

  const evidenceSection =
    evidenceMeta.length > 0
      ? evidenceMeta.map((meta, index) => evidenceIndexLine(index + 1, meta)).join("\n\n")
      : "No evidence entries available.";

  return [
    "# Case Report",
    caseFile.title,
    "",
    `Created: ${createdLine}`,
    `Evidence Count: ${evidenceMeta.length}`,
    "",
    "---",
    "",
    "## Timeline",
    "",
    timelineSection,
    "",
    "---",
    "",
    "## Evidence Index",
    "",
    evidenceSection,
    "",
  ].join("\n");
}
