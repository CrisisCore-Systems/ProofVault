import type { ExportBundle } from "../../domain/types";
import { DEFAULT_REDACTED_EXPORT_SETTINGS } from "./config";

const EXPORT_PREFERENCES_KEY = "proofvault.export.preferences.v1";

export type StoredExportPreferences = {
  selectedCaseId: string;
  mode: ExportBundle["mode"];
  startDate: string;
  endDate: string;
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
};

export const DEFAULT_EXPORT_PREFERENCES: StoredExportPreferences = {
  selectedCaseId: "",
  mode: DEFAULT_REDACTED_EXPORT_SETTINGS.mode,
  startDate: "",
  endDate: "",
  includeAttachments: DEFAULT_REDACTED_EXPORT_SETTINGS.includeAttachments,
  includeMetadataAppendix: DEFAULT_REDACTED_EXPORT_SETTINGS.includeMetadataAppendix,
};

export function readStoredExportPreferences(): StoredExportPreferences | null {
  const raw = globalThis.localStorage.getItem(EXPORT_PREFERENCES_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredExportPreferences;
  } catch {
    return null;
  }
}

export function normalizeStoredExportPreferences(
  preferences?: Partial<StoredExportPreferences> | null
): StoredExportPreferences {
  const normalizedMode =
    preferences?.mode === "full" || preferences?.mode === "redacted" || preferences?.mode === "minimal"
      ? preferences.mode
      : DEFAULT_EXPORT_PREFERENCES.mode;

  return {
    selectedCaseId: preferences?.selectedCaseId ?? DEFAULT_EXPORT_PREFERENCES.selectedCaseId,
    mode: normalizedMode,
    startDate: preferences?.startDate ?? DEFAULT_EXPORT_PREFERENCES.startDate,
    endDate: preferences?.endDate ?? DEFAULT_EXPORT_PREFERENCES.endDate,
    includeAttachments:
      normalizedMode === "minimal"
        ? false
        : (preferences?.includeAttachments ?? DEFAULT_EXPORT_PREFERENCES.includeAttachments),
    includeMetadataAppendix:
      normalizedMode === "minimal"
        ? false
        : (preferences?.includeMetadataAppendix ?? DEFAULT_EXPORT_PREFERENCES.includeMetadataAppendix),
  };
}

export function writeStoredExportPreferences(preferences: StoredExportPreferences) {
  globalThis.localStorage.setItem(EXPORT_PREFERENCES_KEY, JSON.stringify(preferences));
}