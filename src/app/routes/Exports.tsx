import { EmptyStateCard } from "../../components/ui/EmptyStateCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SeedDataButton } from "../../components/ui/SeedDataButton";
import { useExportBuilder } from "../../features/exports/useExportBuilder";
import { ExportBanner } from "./exports/ExportBanner";
import { ExportHistoryPanel } from "./exports/ExportHistoryPanel";
import { ExportPacketForm } from "./exports/ExportPacketForm";
import { ExportPreflightActions } from "./exports/ExportPreflightActions";
import { ExportPresetPicker } from "./exports/ExportPresetPicker";
import { ExportPreviewPanel } from "./exports/ExportPreviewPanel";
import { ManifestSnapshotPanel } from "./exports/ManifestSnapshotPanel";
import { VerifierResultsPanel } from "./exports/VerifierResultsPanel";

export function Exports() {
  const {
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
    proofManifestPreview,
    verifyingProof,
    proofVerification,
    verificationReport,
    handleGenerateExport,
    resetToDefaults,
    applyPreset,
    handleCopySummary,
    handleDownloadManifestPreview,
    handleVerifyProofManifest,
    handleDownloadVerificationReport,
    handlePrintVerificationCertificate,
    load,
  } = useExportBuilder();

  if (cases.length === 0) {
    return (
      <section>
        <SectionHeader
          title="Exports"
          subtitle="Build a case export packet and review generated bundle manifests"
          rightSlot={<SeedDataButton onSeeded={load} />}
        />

        <EmptyStateCard
          title="No cases available"
          description="Create or seed a case before generating an export packet."
        />
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="Exports"
        subtitle="Build a case export packet and review generated bundle manifests"
        rightSlot={<SeedDataButton onSeeded={load} />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section className="pv-card space-y-4">
          <div>
            <h3 className="pv-section-title">Build export packet</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Generate a ZIP bundle with manifest, timeline files, case summary, optional attachments, and an optional metadata appendix.
            </p>
          </div>

          <ExportBanner restoredFromStorage={restoredFromStorage} onReset={resetToDefaults} />
          <ExportPresetPicker
            mode={mode}
            includeAttachments={includeAttachments}
            includeMetadataAppendix={includeMetadataAppendix}
            onApplyPreset={applyPreset}
          />
          <ManifestSnapshotPanel manifest={manifestPreview} />
          <VerifierResultsPanel
            manifest={proofManifestPreview}
            verification={proofVerification}
            verificationReport={verificationReport}
            verifying={verifyingProof}
            onDownloadReport={handleDownloadVerificationReport}
            onPrintCertificate={handlePrintVerificationCertificate}
          />
          <ExportPreflightActions
            previewActionMessage={previewActionMessage}
            onCopySummary={handleCopySummary}
            onDownloadManifestPreview={handleDownloadManifestPreview}
            onVerifyProofManifest={handleVerifyProofManifest}
            verifyingProof={verifyingProof}
          />
          <ExportPacketForm
            cases={cases}
            selectedCaseId={selectedCaseId}
            mode={mode}
            startDate={startDate}
            endDate={endDate}
            includeAttachments={includeAttachments}
            includeMetadataAppendix={includeMetadataAppendix}
            exportableItemsCount={exportableItems.length}
            attachmentCandidates={attachmentCandidates}
            exporting={exporting}
            exportError={exportError}
            exportSuccess={exportSuccess}
            onSubmit={handleGenerateExport}
            onSelectCase={setSelectedCaseId}
            onChangeStartDate={setStartDate}
            onChangeEndDate={setEndDate}
            onSelectMode={setMode}
            onToggleAttachments={setIncludeAttachments}
            onToggleMetadataAppendix={setIncludeMetadataAppendix}
          />
          <ExportPreviewPanel previewItems={previewItems} />
        </section>

        <ExportHistoryPanel bundles={bundles} cases={cases} />
      </div>
    </section>
  );
}
