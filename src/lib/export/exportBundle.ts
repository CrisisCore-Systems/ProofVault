import JSZip from "jszip";
import type { CaseFile, EvidenceItem, ExportBundle } from "../../domain/types";
import {
  getHydratedAttachmentByEvidenceItemId,
  listLedgerEntries,
  upsertExportBundle,
} from "../../db/queries";
import { buildCaseTimeline, resolveTimelineTimestamp } from "../../features/cases/timeline";
import { appendLedgerEvent } from "../../features/ledger/chain";
import type { TimelineEvent } from "../../features/cases/timeline";
import { formatDisplayDateTime } from "../dates/format";
import { downloadBlobFile } from "../utils/download";
import { bakeRedactedImage } from "../utils/redactionBake";
import { generateCaseReportMarkdown, type CaseReportEvidenceMeta } from "./caseReport";
import { shortFingerprint } from "./integrityFingerprints";
import { buildProofVaultEvidenceManifest, createProofVaultRedactionPolicy } from "./proofVault";
import {
  createExportSerializationPolicy,
  resolveSerializedAttachmentName,
  serializeEvidenceItemForExport,
  type ExportSerializationPolicy,
} from "./serializationPolicy";

export type ExportPacketOptions = {
  caseFile: CaseFile;
  items: EvidenceItem[];
  mode: ExportBundle["mode"];
  startDate?: string;
  endDate?: string;
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
};

export type ExportPacketResult = {
  bundle: ExportBundle;
  downloadedFileName: string;
  exportedItemCount: number;
  exportedAttachmentCount: number;
};

export type ExportPreviewItem = {
  id: string;
  title: string;
  kind: EvidenceItem["kind"];
  timestamp: string;
  included: boolean;
  selectionReason: string;
  attachmentDisposition: "included" | "omitted" | "not-applicable";
  attachmentReason: string;
};

export type ExportPreviewManifest = {
  schemaVersion: 1;
  preview: true;
  generatedAt: string;
  case: {
    id: string;
    title: string;
    type: CaseFile["type"];
    status: CaseFile["status"];
  };
  options: {
    mode: ExportBundle["mode"];
    includeAttachments: boolean;
    includeMetadataAppendix: boolean;
    startDate: string | null;
    endDate: string | null;
  };
  counts: {
    totalItems: number;
    includedItems: number;
    excludedItems: number;
    attachmentsIncluded: number;
    attachmentsOmitted: number;
    itemsWithoutAttachments: number;
  };
  items: ExportPreviewItem[];
};

type ManifestItem = {
  id: string;
  title: string;
  kind: EvidenceItem["kind"];
  timestamp: string;
  recordedAt: string;
  occurredAt?: string;
  includeInExport: boolean;
  redactionStatus: EvidenceItem["redactionStatus"];
  dateCertainty: EvidenceItem["dateCertainty"];
  originalFilename?: string;
  mimeType?: string;
  sha256?: string;
  attachmentPath?: string;
  attachmentStatus: "included" | "omitted" | "missing" | "not-applicable";
  omissionReason?: string;
};

function sanitizeFileSegment(value: string): string {
  const sanitized = value
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");

  return sanitized.length > 0 ? sanitized : "evidence";
}

function withUniqueName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const extensionStart = name.lastIndexOf(".");
  const hasExtension = extensionStart > 0;
  const baseName = hasExtension ? name.slice(0, extensionStart) : name;
  const extension = hasExtension ? name.slice(extensionStart) : "";

  let index = 2;
  while (usedNames.has(`${baseName}_${index}${extension}`)) {
    index += 1;
  }

  const uniqueName = `${baseName}_${index}${extension}`;
  usedNames.add(uniqueName);
  return uniqueName;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function toExportStamp(isoDate: string): string {
  return isoDate.replaceAll(/[:.]/g, "-");
}

function createStableZipEntryDate(isoDateTime: string): Date {
  const parsedDate = new Date(isoDateTime);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date(0);
  }

  return new Date(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth(),
    parsedDate.getUTCDate(),
    parsedDate.getUTCHours(),
    parsedDate.getUTCMinutes(),
    parsedDate.getUTCSeconds(),
    parsedDate.getUTCMilliseconds()
  );
}

function isWithinDateRange(item: EvidenceItem, startDate?: string, endDate?: string): boolean {
  const timestamp = Date.parse(resolveTimelineTimestamp(item));
  const startEpoch = startDate ? Date.parse(`${startDate}T00:00:00`) : undefined;
  const endEpoch = endDate ? Date.parse(`${endDate}T23:59:59.999`) : undefined;

  if (startEpoch !== undefined && timestamp < startEpoch) {
    return false;
  }

  if (endEpoch !== undefined && timestamp > endEpoch) {
    return false;
  }

  return true;
}

function resolveAttachmentPreview(
  item: EvidenceItem,
  options: ExportPacketOptions,
  policy: ExportSerializationPolicy
): Pick<ExportPreviewItem, "attachmentDisposition" | "attachmentReason"> {
  if (!item.fileRef) {
    return {
      attachmentDisposition: "not-applicable",
      attachmentReason: "No attachment file on this item.",
    };
  }

  if (!policy.includeAttachments) {
    return {
      attachmentDisposition: "omitted",
      attachmentReason: "Attachments excluded by current export settings.",
    };
  }

  if (options.mode === "redacted" && item.redactionStatus === "full") {
    return {
      attachmentDisposition: "omitted",
      attachmentReason: "Fully redacted attachment will be omitted.",
    };
  }

  const mimeType = item.mimeType ?? "";
  const isImageAttachment = mimeType.startsWith("image/");
  const hasRedactions = (item.redactions?.length ?? 0) > 0;

  if (options.mode === "redacted" && item.redactionStatus !== "none" && !isImageAttachment) {
    return {
      attachmentDisposition: "omitted",
      attachmentReason: "Non-image attachment with redactions cannot be exported in redacted mode.",
    };
  }

  if (options.mode === "redacted" && hasRedactions && isImageAttachment) {
    return {
      attachmentDisposition: "included",
      attachmentReason: "Image attachment will be exported as a baked redacted derivative.",
    };
  }

  return {
    attachmentDisposition: "included",
    attachmentReason: "Attachment will be included in the ZIP.",
  };
}

function resolveSelectionReason(item: EvidenceItem, options: ExportPacketOptions): string {
  if (!item.includeInExport) {
    return "Item is currently excluded from export.";
  }

  if (!isWithinDateRange(item, options.startDate, options.endDate)) {
    return "Item falls outside the selected date range.";
  }

  return "Item will be included in the export packet.";
}

export function buildExportPreview(options: ExportPacketOptions): ExportPreviewItem[] {
  const policy = createExportSerializationPolicy(options);

  return [...options.items]
    .sort((left, right) => Date.parse(resolveTimelineTimestamp(left)) - Date.parse(resolveTimelineTimestamp(right)))
    .map((item) => {
      const included = item.includeInExport && isWithinDateRange(item, options.startDate, options.endDate);

      return {
        id: item.id,
        title: item.title,
        kind: item.kind,
        timestamp: resolveTimelineTimestamp(item),
        included,
        selectionReason: resolveSelectionReason(item, options),
        ...resolveAttachmentPreview(item, options, policy),
      };
    });
}

export function buildExportPreviewManifest(options: ExportPacketOptions): ExportPreviewManifest {
  const items = buildExportPreview(options);
  const policy = createExportSerializationPolicy(options);

  return {
    schemaVersion: 1,
    preview: true,
    generatedAt: new Date().toISOString(),
    case: {
      id: options.caseFile.id,
      title: options.caseFile.title,
      type: options.caseFile.type,
      status: options.caseFile.status,
    },
    options: {
      mode: options.mode,
      includeAttachments: policy.includeAttachments,
      includeMetadataAppendix: policy.includeMetadataAppendix,
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
    },
    counts: {
      totalItems: items.length,
      includedItems: items.filter((item) => item.included).length,
      excludedItems: items.filter((item) => !item.included).length,
      attachmentsIncluded: items.filter((item) => item.attachmentDisposition === "included").length,
      attachmentsOmitted: items.filter((item) => item.attachmentDisposition === "omitted").length,
      itemsWithoutAttachments: items.filter((item) => item.attachmentDisposition === "not-applicable").length,
    },
    items,
  };
}

export function buildExportPreviewSummary(options: ExportPacketOptions): string {
  const manifest = buildExportPreviewManifest(options);
  const includedItems = manifest.items.filter((item) => item.included);
  const excludedItems = manifest.items.filter((item) => !item.included);

  return [
    "ProofVault Export Preview",
    "",
    `Case: ${manifest.case.title}`,
    `Case ID: ${manifest.case.id}`,
    `Mode: ${manifest.options.mode}`,
    `Date Range: ${manifest.options.startDate ?? "start"} → ${manifest.options.endDate ?? "latest"}`,
    `Include Attachments: ${manifest.options.includeAttachments ? "yes" : "no"}`,
    `Include Metadata Appendix: ${manifest.options.includeMetadataAppendix ? "yes" : "no"}`,
    `Preview Generated: ${formatDisplayDateTime(manifest.generatedAt)}`,
    "",
    `Included Items: ${manifest.counts.includedItems}`,
    `Excluded Items: ${manifest.counts.excludedItems}`,
    `Attachments Included: ${manifest.counts.attachmentsIncluded}`,
    `Attachments Omitted: ${manifest.counts.attachmentsOmitted}`,
    `Items Without Attachments: ${manifest.counts.itemsWithoutAttachments}`,
    "",
    "Included:",
    ...(includedItems.length > 0
      ? includedItems.slice(0, 8).map((item) => `- ${item.title} (${item.kind}) — ${item.attachmentReason}`)
      : ["- None"]),
    "",
    "Excluded:",
    ...(excludedItems.length > 0
      ? excludedItems.slice(0, 8).map((item) => `- ${item.title} (${item.kind}) — ${item.selectionReason}`)
      : ["- None"]),
  ].join("\n");
}

function buildCaseSummaryText(
  caseFile: CaseFile,
  exportedAt: string,
  options: ExportPacketOptions,
  itemCount: number,
  attachmentCount: number
): string {
  return [
    "ProofVault Export Summary",
    "",
    `Case: ${caseFile.title}`,
    `Case ID: ${caseFile.id}`,
    `Case Type: ${caseFile.type}`,
    `Case Status: ${caseFile.status}`,
    `Exported At: ${formatDisplayDateTime(exportedAt)}`,
    `Mode: ${options.mode}`,
    `Date Range: ${options.startDate || "start"} → ${options.endDate || "latest"}`,
    `Items Exported: ${itemCount}`,
    `Attachments Exported: ${attachmentCount}`,
    `Include Attachments: ${options.includeAttachments ? "yes" : "no"}`,
    `Include Metadata Appendix: ${options.includeMetadataAppendix ? "yes" : "no"}`,
  ].join("\n");
}

function buildExportFingerprintText(input: {
  caseFile: CaseFile;
  exportedAt: string;
  proofManifestFile: string;
  manifestSeal: string;
}): string {
  return [
    "ProofVault Export Fingerprint",
    "",
    `Case: ${input.caseFile.title}`,
    `Case ID: ${input.caseFile.id}`,
    `Exported At: ${formatDisplayDateTime(input.exportedAt)}`,
    `Proof Manifest: ${input.proofManifestFile}`,
    "",
    `Manifest Fingerprint: ${shortFingerprint(input.manifestSeal)}`,
    `Manifest Seal SHA-256: ${input.manifestSeal}`,
    "",
    "Use the manifest fingerprint as a spoken cross-check before opening the app, PDF, or JSON report.",
    "After verification, the generated report will include its own report checksum for a second cross-check.",
  ].join("\n");
}

function buildTimelineMarkdown(caseFile: CaseFile, timelineEvents: TimelineEvent[]): string {
  if (timelineEvents.length === 0) {
    return ["# Timeline", "", `Case: ${caseFile.title}`, "", "No timeline events included."].join("\n");
  }

  const eventLines = timelineEvents.flatMap((event) => [
    `## ${formatDisplayDateTime(event.timestamp)}`,
    `- Title: ${event.title}`,
    `- Type: ${event.type}`,
    `- Kind: ${event.kind}`,
    `- Reference: ${event.referenceId}`,
    "",
  ]);

  return ["# Timeline", "", `Case: ${caseFile.title}`, "", ...eventLines].join("\n");
}

function buildTimelineCsv(items: EvidenceItem[], policy: ExportSerializationPolicy): string {
  const header = [
    "timestamp",
    "id",
    "title",
    "kind",
    "recordedAt",
    "occurredAt",
    "caseId",
    "includeInExport",
    "redactionStatus",
    "dateCertainty",
    ...(policy.allowsPeopleInvolved ? ["peopleInvolved"] : []),
    ...(policy.allowsTags ? ["tags"] : []),
  ];

  const rows = items.map((item) => {
    const serialized = serializeEvidenceItemForExport(item, policy);

    return [
      resolveTimelineTimestamp(serialized),
      serialized.id,
      serialized.title,
      serialized.kind,
      serialized.recordedAt,
      serialized.occurredAt ?? "",
      serialized.caseId ?? "",
      String(serialized.includeInExport),
      serialized.redactionStatus,
      serialized.dateCertainty,
      ...(policy.allowsPeopleInvolved ? [serialized.peopleInvolved?.join(" | ") ?? ""] : []),
      ...(policy.allowsTags ? [serialized.tags?.join(" | ") ?? ""] : []),
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsvCell(value)).join(","))
    .join("\n");
}

function buildManifestBase(item: EvidenceItem, policy: ExportSerializationPolicy) {
  const serialized = serializeEvidenceItemForExport(item, policy);

  return {
    id: serialized.id,
    title: serialized.title,
    kind: serialized.kind,
    timestamp: resolveTimelineTimestamp(serialized),
    recordedAt: serialized.recordedAt,
    occurredAt: serialized.occurredAt,
    includeInExport: serialized.includeInExport,
    redactionStatus: serialized.redactionStatus,
    dateCertainty: serialized.dateCertainty,
    originalFilename: serialized.originalFilename,
    mimeType: serialized.mimeType,
    sha256: serialized.sha256,
  };
}

function buildBaseEvidenceMeta(item: EvidenceItem, policy: ExportSerializationPolicy): CaseReportEvidenceMeta {
  const serialized = serializeEvidenceItemForExport(item, policy);

  return {
    evidence: serialized,
    sizeBytes: undefined,
    mimeType: serialized.mimeType,
    sha256: serialized.sha256,
  };
}

function buildManifestWithoutAttachment(
  item: EvidenceItem,
  policy: ExportSerializationPolicy,
  attachmentStatus: "omitted" | "missing" | "not-applicable",
  omissionReason: string
): ManifestItem {
  return {
    ...buildManifestBase(item, policy),
    attachmentStatus,
    omissionReason,
  };
}

function resolveAttachmentMimeType(item: EvidenceItem, attachment: Blob & { type: string }, attachmentMimeType?: string) {
  return attachmentMimeType || item.mimeType || attachment.type;
}

function shouldOmitAttachmentForRedaction(item: EvidenceItem, attachmentMimeType: string, mode: ExportBundle["mode"]) {
  if (mode !== "redacted") {
    return undefined;
  }

  if (item.redactionStatus === "full") {
    return "fully-redacted";
  }

  if (item.redactionStatus !== "none" && !attachmentMimeType.startsWith("image/")) {
    return "unsupported-redaction-type";
  }

  return undefined;
}

type ProcessExportItemParams = {
  item: EvidenceItem;
  options: ExportPacketOptions;
  policy: ExportSerializationPolicy;
  attachmentsFolder?: JSZip | null;
  usedAttachmentNames: Set<string>;
  caseAttachmentIds: Set<string>;
};

type ProcessExportItemResult = {
  evidenceMeta: CaseReportEvidenceMeta;
  manifestItem: ManifestItem;
  exportedAttachment: boolean;
};

async function processExportItem({
  item,
  options,
  policy,
  attachmentsFolder,
  usedAttachmentNames,
  caseAttachmentIds,
  zipEntryDate,
}: ProcessExportItemParams & { zipEntryDate: Date }): Promise<ProcessExportItemResult> {
  const serializedItem = serializeEvidenceItemForExport(item, policy);
  const baseMeta = buildBaseEvidenceMeta(item, policy);

  if (!item.fileRef) {
    return {
      evidenceMeta: baseMeta,
      manifestItem: buildManifestWithoutAttachment(item, policy, "not-applicable", "no-attachment"),
      exportedAttachment: false,
    };
  }

  if (!policy.includeAttachments) {
    return {
      evidenceMeta: baseMeta,
      manifestItem: buildManifestWithoutAttachment(item, policy, "omitted", "attachments-disabled"),
      exportedAttachment: false,
    };
  }

  const attachment = await getHydratedAttachmentByEvidenceItemId(item.id);
  if (!attachment) {
    return {
      evidenceMeta: baseMeta,
      manifestItem: buildManifestWithoutAttachment(item, policy, "missing", "attachment-missing"),
      exportedAttachment: false,
    };
  }

  caseAttachmentIds.add(attachment.id);

  const attachmentMimeType = resolveAttachmentMimeType(item, attachment.blob, attachment.mimeType);
  const omitReason = shouldOmitAttachmentForRedaction(item, attachmentMimeType, options.mode);
  if (omitReason) {
    return {
      evidenceMeta: baseMeta,
      manifestItem: buildManifestWithoutAttachment(item, policy, "omitted", omitReason),
      exportedAttachment: false,
    };
  }

  let outputBlob = attachment.blob;
  let outputMimeType = attachmentMimeType;
  let outputSha256 = serializedItem.sha256;
  let isRedactedDerivative = false;

  const hasImageRedactions =
    options.mode === "redacted" &&
    (item.redactions?.length ?? 0) > 0 &&
    attachmentMimeType.startsWith("image/");

  if (hasImageRedactions) {
    const baked = await bakeRedactedImage(attachment.blob, item.redactions ?? []);
    outputBlob = baked.bakedBlob;
    outputMimeType = baked.bakedBlob.type || "image/png";
    outputSha256 = policy.allowsSha256 ? baked.bakedHash : undefined;
    isRedactedDerivative = true;
  }

  const outputName = sanitizeFileSegment(
    resolveSerializedAttachmentName({
      item,
      attachment,
      attachmentMimeType: outputMimeType,
      policy,
      isRedactedDerivative,
    })
  );
  const finalName = withUniqueName(outputName, usedAttachmentNames);

  attachmentsFolder?.file(finalName, await outputBlob.arrayBuffer(), { date: zipEntryDate });

  return {
    evidenceMeta: {
      evidence: serializedItem,
      sizeBytes: outputBlob.size,
      mimeType: outputMimeType,
      sha256: outputSha256,
      isRedactedDerivative,
      originalSha256: policy.allowsSha256 ? serializedItem.sha256 : undefined,
    },
    manifestItem: {
      ...buildManifestBase(item, policy),
      mimeType: outputMimeType,
      sha256: outputSha256,
      attachmentPath: `attachments/${finalName}`,
      attachmentStatus: "included",
    },
    exportedAttachment: true,
  };
}

export async function generateExportPacket(options: ExportPacketOptions): Promise<ExportPacketResult> {
  const policy = createExportSerializationPolicy(options);
  const exportedAt = new Date().toISOString();
  const zipEntryDate = createStableZipEntryDate(exportedAt);
  const selectedItems = options.items
    .filter((item) => item.includeInExport && isWithinDateRange(item, options.startDate, options.endDate))
    .sort((left, right) => Date.parse(resolveTimelineTimestamp(left)) - Date.parse(resolveTimelineTimestamp(right)));

  if (selectedItems.length === 0) {
    throw new Error("No export-ready items match the selected case and date range.");
  }

  const zip = new JSZip();
  if (policy.includeAttachments) {
    zip.file("attachments/", "", { dir: true, date: zipEntryDate });
  }

  const attachmentsFolder = policy.includeAttachments ? zip.folder("attachments") : undefined;
  if (policy.includeAttachments && !attachmentsFolder) {
    throw new Error("Unable to initialize attachments folder in export archive.");
  }

  const usedAttachmentNames = new Set<string>();
  const caseAttachmentIds = new Set<string>();
  let exportedAttachmentCount = 0;
  const processedItems = await Promise.all(
    selectedItems.map((item) =>
      processExportItem({
        item,
        options,
        policy,
        attachmentsFolder,
        usedAttachmentNames,
        caseAttachmentIds,
        zipEntryDate,
      })
    )
  );
  const manifestItems = processedItems.map((result) => result.manifestItem);
  const evidenceMeta = processedItems.map((result) => result.evidenceMeta);
  exportedAttachmentCount = processedItems.filter((result) => result.exportedAttachment).length;

  const timelineEvents = buildCaseTimeline(options.caseFile.id, selectedItems);
  const slug = slugify(options.caseFile.title) || "case";
  const stamp = toExportStamp(exportedAt);
  const manifestRef = `manifest-${stamp}.json`;
  const archiveRef = `proofvault-${slug}-${options.mode}-${stamp}.zip`;

  const caseLedger = policy.includeMetadataAppendix
    ? (await listLedgerEntries()).filter(
        (entry) =>
          entry.caseId === options.caseFile.id ||
          (entry.attachmentId ? caseAttachmentIds.has(entry.attachmentId) : false)
      )
    : [];

  const manifest = {
    schemaVersion: 1,
    generatedAt: exportedAt,
    outputFormat: "zip",
    case: {
      id: options.caseFile.id,
      title: options.caseFile.title,
      type: options.caseFile.type,
      status: options.caseFile.status,
    },
    options: {
      mode: options.mode,
      includeAttachments: policy.includeAttachments,
      includeMetadataAppendix: policy.includeMetadataAppendix,
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
    },
    counts: {
      items: selectedItems.length,
      timelineEvents: timelineEvents.length,
      attachments: exportedAttachmentCount,
      metadataEntries: caseLedger.length,
    },
    files: {
      manifest: manifestRef,
      timelineMarkdown: "timeline.md",
      timelineCsv: "timeline.csv",
      caseSummary: "case-summary.txt",
      fingerprint: "FINGERPRINT.txt",
      evidenceProof: "proof-vault-evidence.json",
      metadataAppendix: policy.includeMetadataAppendix ? "metadata-appendix.md" : null,
      ledgerAudit: policy.includeMetadataAppendix && caseLedger.length > 0 ? "ledger-audit.json" : null,
    },
    items: manifestItems,
  };

  const proofManifest = await buildProofVaultEvidenceManifest({
    caseFile: options.caseFile,
    items: selectedItems,
    exportTimestamp: exportedAt,
    outputFormat: "zip",
    redactionPolicy: createProofVaultRedactionPolicy({
      mode: policy.mode,
      includeAttachments: policy.includeAttachments,
      includeMetadataAppendix: policy.includeMetadataAppendix,
    }),
  });

  zip.file(
    "case-summary.txt",
    buildCaseSummaryText(
      options.caseFile,
      exportedAt,
      {
        ...options,
        mode: policy.mode,
        includeAttachments: policy.includeAttachments,
        includeMetadataAppendix: policy.includeMetadataAppendix,
      },
      selectedItems.length,
      exportedAttachmentCount
    ),
    { date: zipEntryDate }
  );
  zip.file("timeline.md", buildTimelineMarkdown(options.caseFile, timelineEvents), { date: zipEntryDate });
  zip.file("timeline.csv", buildTimelineCsv(selectedItems, policy), { date: zipEntryDate });
  zip.file(manifestRef, JSON.stringify(manifest, null, 2), { date: zipEntryDate });
  zip.file(
    "FINGERPRINT.txt",
    buildExportFingerprintText({
      caseFile: options.caseFile,
      exportedAt,
      proofManifestFile: "proof-vault-evidence.json",
      manifestSeal: proofManifest.integritySeal,
    }),
    { date: zipEntryDate }
  );
  zip.file("proof-vault-evidence.json", JSON.stringify(proofManifest, null, 2), { date: zipEntryDate });

  if (policy.includeMetadataAppendix) {
    zip.file("metadata-appendix.md", generateCaseReportMarkdown(options.caseFile, timelineEvents, evidenceMeta), { date: zipEntryDate });

    if (caseLedger.length > 0) {
      zip.file(
        "ledger-audit.json",
        JSON.stringify(
          {
            caseId: options.caseFile.id,
            caseTitle: options.caseFile.title,
            exportedAt,
            entries: caseLedger,
          },
          null,
          2
        ),
        { date: zipEntryDate }
      );
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", platform: "DOS" });
  downloadBlobFile(archiveRef, zipBlob);

  const bundle: ExportBundle = {
    id: crypto.randomUUID(),
    caseId: options.caseFile.id,
    mode: options.mode,
    createdAt: exportedAt,
    itemIds: selectedItems.map((item) => item.id),
    manifestRef,
    archiveRef,
  };

  await upsertExportBundle(bundle);
  await appendLedgerEvent({
    event: "export.generated",
    caseId: options.caseFile.id,
    data: {
      bundleId: bundle.id,
      mode: options.mode,
      itemCount: selectedItems.length,
      attachmentCount: exportedAttachmentCount,
      includeAttachments: policy.includeAttachments,
      includeMetadataAppendix: policy.includeMetadataAppendix,
      proofRecordCount: proofManifest.recordCount,
      proofIntegritySeal: proofManifest.integritySeal,
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
    },
  });

  return {
    bundle,
    downloadedFileName: archiveRef,
    exportedItemCount: selectedItems.length,
    exportedAttachmentCount: exportedAttachmentCount,
  };
}