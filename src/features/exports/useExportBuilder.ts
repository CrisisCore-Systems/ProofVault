import { useEffect, useMemo, useState, type ComponentProps } from "react";
import type { CaseFile, EvidenceItem, ExportBundle } from "../../domain/types";
import { listCases, listEvidenceItemsForCase, listExportBundles } from "../../db/queries";
import {
  buildExportPreview,
  buildExportPreviewManifest,
  generateExportPacket,
  type ExportPreviewManifest,
  type ExportPreviewItem,
} from "../../lib/export/exportBundle";
import { resolveTimelineTimestamp } from "../cases/timeline";
import { copyExportPreviewSummary, downloadExportPreviewManifest } from "./preflight";
import {
  DEFAULT_EXPORT_PREFERENCES,
  normalizeStoredExportPreferences,
  readStoredExportPreferences,
  writeStoredExportPreferences,
} from "./preferences";

type ExportPresetSelection = Pick<
  ExportBundle,
  "mode"
> & {
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
};

function isWithinDateRange(item: EvidenceItem, startDate: string, endDate: string): boolean {
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

export function useExportBuilder() {
  const rawStoredPreferences = readStoredExportPreferences();
  const storedPreferences = normalizeStoredExportPreferences(rawStoredPreferences);
  const restoredFromStorage = rawStoredPreferences !== null;

  const [cases, setCases] = useState<CaseFile[]>([]);
  const [bundles, setBundles] = useState<ExportBundle[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState(storedPreferences.selectedCaseId);
  const [caseItems, setCaseItems] = useState<EvidenceItem[]>([]);
  const [mode, setMode] = useState<ExportBundle["mode"]>(storedPreferences.mode);
  const [startDate, setStartDate] = useState(storedPreferences.startDate);
  const [endDate, setEndDate] = useState(storedPreferences.endDate);
  const [includeAttachments, setIncludeAttachments] = useState(storedPreferences.includeAttachments);
  const [includeMetadataAppendix, setIncludeMetadataAppendix] = useState(storedPreferences.includeMetadataAppendix);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [previewActionMessage, setPreviewActionMessage] = useState<string | null>(null);

  const load = async () => {
    const [bundleData, caseData] = await Promise.all([listExportBundles(), listCases()]);
    setBundles(bundleData);
    setCases(caseData);
    setSelectedCaseId((current) => {
      if (current && caseData.some((caseFile) => caseFile.id === current)) {
        return current;
      }

      if (
        storedPreferences.selectedCaseId &&
        caseData.some((caseFile) => caseFile.id === storedPreferences.selectedCaseId)
      ) {
        return storedPreferences.selectedCaseId;
      }

      return caseData[0]?.id || "";
    });
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedCaseId) {
      setCaseItems([]);
      return;
    }

    const loadCaseItems = async () => {
      const data = await listEvidenceItemsForCase(selectedCaseId);
      setCaseItems(data);
    };

    void loadCaseItems();
  }, [selectedCaseId]);

  useEffect(() => {
    writeStoredExportPreferences({
      selectedCaseId,
      mode,
      startDate,
      endDate,
      includeAttachments,
      includeMetadataAppendix,
    });
  }, [selectedCaseId, mode, startDate, endDate, includeAttachments, includeMetadataAppendix]);

  const selectedCase = useMemo(
    () => cases.find((caseFile) => caseFile.id === selectedCaseId),
    [cases, selectedCaseId]
  );

  const exportableItems = useMemo(
    () => caseItems.filter((item) => item.includeInExport && isWithinDateRange(item, startDate, endDate)),
    [caseItems, startDate, endDate]
  );

  const attachmentCandidates = useMemo(
    () => exportableItems.filter((item) => Boolean(item.fileRef)).length,
    [exportableItems]
  );

  const previewItems = useMemo<ExportPreviewItem[]>(
    () =>
      selectedCase
        ? buildExportPreview({
            caseFile: selectedCase,
            items: caseItems,
            mode,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            includeAttachments,
            includeMetadataAppendix,
          })
        : [],
    [caseItems, endDate, includeAttachments, includeMetadataAppendix, mode, selectedCase, startDate]
  );

  const manifestPreview = useMemo<ExportPreviewManifest | null>(
    () =>
      selectedCase
        ? buildExportPreviewManifest({
            caseFile: selectedCase,
            items: caseItems,
            mode,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            includeAttachments,
            includeMetadataAppendix,
          })
        : null,
    [caseItems, endDate, includeAttachments, includeMetadataAppendix, mode, selectedCase, startDate]
  );

  const handleGenerateExport: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    setExportError(null);
    setExportSuccess(null);
    setPreviewActionMessage(null);

    if (!selectedCase) {
      setExportError("Choose a case to generate an export.");
      return;
    }

    const run = async () => {
      setExporting(true);

      try {
        const result = await generateExportPacket({
          caseFile: selectedCase,
          items: caseItems,
          mode,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          includeAttachments,
          includeMetadataAppendix,
        });

        setExportSuccess(
          `Export generated: ${result.downloadedFileName} (${result.exportedItemCount} items, ${result.exportedAttachmentCount} attachments).`
        );
        await load();
      } catch (error) {
        setExportError(error instanceof Error ? error.message : "Unable to generate export bundle.");
      } finally {
        setExporting(false);
      }
    };

    void run();
  };

  const resetToDefaults = () => {
    setSelectedCaseId(cases[0]?.id ?? DEFAULT_EXPORT_PREFERENCES.selectedCaseId);
    setMode(DEFAULT_EXPORT_PREFERENCES.mode);
    setStartDate(DEFAULT_EXPORT_PREFERENCES.startDate);
    setEndDate(DEFAULT_EXPORT_PREFERENCES.endDate);
    setIncludeAttachments(DEFAULT_EXPORT_PREFERENCES.includeAttachments);
    setIncludeMetadataAppendix(DEFAULT_EXPORT_PREFERENCES.includeMetadataAppendix);
    setExportError(null);
    setExportSuccess(null);
    setPreviewActionMessage(null);
  };

  const applyPreset = (preset: ExportPresetSelection) => {
    setMode(preset.mode);
    setIncludeAttachments(preset.includeAttachments);
    setIncludeMetadataAppendix(preset.includeMetadataAppendix);
    setExportError(null);
    setExportSuccess(null);
    setPreviewActionMessage(null);
  };

  const handleCopySummary = async () => {
    setExportError(null);
    setExportSuccess(null);

    if (!selectedCase) {
      setPreviewActionMessage("Choose a case to copy an export summary.");
      return;
    }

    const result = await copyExportPreviewSummary({
      caseFile: selectedCase,
      items: caseItems,
      mode,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includeAttachments,
      includeMetadataAppendix,
    });

    setPreviewActionMessage(result.message);
  };

  const handleDownloadManifestPreview = () => {
    setExportError(null);
    setExportSuccess(null);

    if (!selectedCase) {
      setPreviewActionMessage("Choose a case to download a manifest preview.");
      return;
    }

    const result = downloadExportPreviewManifest({
      caseFile: selectedCase,
      items: caseItems,
      mode,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includeAttachments,
      includeMetadataAppendix,
    });

    setPreviewActionMessage(result.message);
  };

  return {
    restoredFromStorage,
    cases,
    bundles,
    selectedCaseId,
    setSelectedCaseId,
    mode,
    setMode,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    includeAttachments,
    setIncludeAttachments,
    includeMetadataAppendix,
    setIncludeMetadataAppendix,
    exporting,
    exportError,
    exportSuccess,
    previewActionMessage,
    exportableItems,
    attachmentCandidates,
    previewItems,
    manifestPreview,
    handleGenerateExport,
    resetToDefaults,
    applyPreset,
    handleCopySummary,
    handleDownloadManifestPreview,
    load,
  };
}