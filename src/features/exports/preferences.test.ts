import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_EXPORT_PREFERENCES,
  normalizeStoredExportPreferences,
  readStoredExportPreferences,
  writeStoredExportPreferences,
} from "./preferences";

const storageState = new Map<string, string>();

beforeEach(() => {
  storageState.clear();

  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storageState.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageState.set(key, value);
      },
      removeItem: (key: string) => {
        storageState.delete(key);
      },
      clear: () => {
        storageState.clear();
      },
    },
    configurable: true,
  });
});

describe("export preferences", () => {
  it("returns null when nothing has been stored", () => {
    expect(readStoredExportPreferences()).toBeNull();
  });

  it("returns null for malformed stored JSON", () => {
    storageState.set("proofvault.export.preferences.v1", "{bad json");

    expect(readStoredExportPreferences()).toBeNull();
  });

  it("writes and reads stored preferences", () => {
    const preferences = {
      selectedCaseId: "case-9",
      mode: "full" as const,
      startDate: "2026-03-01",
      endDate: "2026-03-09",
      includeAttachments: false,
      includeMetadataAppendix: true,
    };

    writeStoredExportPreferences(preferences);

    expect(readStoredExportPreferences()).toEqual(preferences);
  });

  it("normalizes missing values back to defaults", () => {
    expect(normalizeStoredExportPreferences(null)).toEqual(DEFAULT_EXPORT_PREFERENCES);

    expect(
      normalizeStoredExportPreferences({
        selectedCaseId: "case-2",
        startDate: "2026-03-02",
      })
    ).toEqual({
      ...DEFAULT_EXPORT_PREFERENCES,
      selectedCaseId: "case-2",
      startDate: "2026-03-02",
    });
  });

  it("only preserves full mode explicitly and falls back otherwise", () => {
    expect(normalizeStoredExportPreferences({ mode: "full" })).toMatchObject({ mode: "full" });
    expect(normalizeStoredExportPreferences({ mode: "redacted" })).toMatchObject({
      mode: DEFAULT_EXPORT_PREFERENCES.mode,
    });
  });
});