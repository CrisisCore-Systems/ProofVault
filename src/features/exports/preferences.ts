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
  return {
    selectedCaseId: preferences?.selectedCaseId ?? DEFAULT_EXPORT_PREFERENCES.selectedCaseId,
    mode: preferences?.mode === "full" ? "full" : DEFAULT_EXPORT_PREFERENCES.mode,
    startDate: preferences?.startDate ?? DEFAULT_EXPORT_PREFERENCES.startDate,
    endDate: preferences?.endDate ?? DEFAULT_EXPORT_PREFERENCES.endDate,
    includeAttachments: preferences?.includeAttachments ?? DEFAULT_EXPORT_PREFERENCES.includeAttachments,
    includeMetadataAppendix:
      preferences?.includeMetadataAppendix ?? DEFAULT_EXPORT_PREFERENCES.includeMetadataAppendix,
  };
}

export function writeStoredExportPreferences(preferences: StoredExportPreferences) {
  globalThis.localStorage.setItem(EXPORT_PREFERENCES_KEY, JSON.stringify(preferences));
}