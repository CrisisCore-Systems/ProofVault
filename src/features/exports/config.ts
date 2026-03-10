import type { ExportBundle } from "../../domain/types";

export type ExportPacketSettings = {
  mode: ExportBundle["mode"];
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
};

export const DEFAULT_REDACTED_EXPORT_SETTINGS: ExportPacketSettings = {
  mode: "redacted",
  includeAttachments: true,
  includeMetadataAppendix: true,
};

export const SUMMARY_REVIEW_EXPORT_SETTINGS: ExportPacketSettings = {
  mode: "redacted",
  includeAttachments: false,
  includeMetadataAppendix: true,
};

export const FULL_ARCHIVE_EXPORT_SETTINGS: ExportPacketSettings = {
  mode: "full",
  includeAttachments: true,
  includeMetadataAppendix: true,
};