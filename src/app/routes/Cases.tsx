import { AddAttachmentButton } from "../../components/ui/AddAttachmentButton";
import { EmptyStateCard } from "../../components/ui/EmptyStateCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useCasesOverview } from "../../features/cases/useCasesOverview";
import { CaseCard } from "./cases/CaseCard";
import { CasesHeaderActions } from "./cases/CasesHeaderActions";
import { CasesOverviewStats } from "./cases/CasesOverviewStats";

export function Cases() {
  const {
    cases,
    verificationByCaseId,
    exportByCaseId,
    previewMessageByCaseId,
    showStaleOnly,
    setShowStaleOnly,
    dropTargetCaseId,
    setDropTargetCaseId,
    ledgerHealth,
    staleCaseCount,
    totalEvidenceFiles,
    verificationCurrentCases,
    mismatchCount,
    visibleCases,
    load,
    exportCaseReport,
    handleCopyExportSummary,
    handleDownloadManifestPreview,
    verifyCaseEvidence,
    handleCaseDrop,
  } = useCasesOverview();

  return (
    <section>
      <SectionHeader
        title={showStaleOnly ? "Cases (stale only)" : "Cases"}
        subtitle={`${cases.length} cases • ${staleCaseCount} stale`}
        rightSlot={
          <CasesHeaderActions
            showStaleOnly={showStaleOnly}
            staleCaseCount={staleCaseCount}
            onToggleShowStaleOnly={() => setShowStaleOnly((previous) => !previous)}
            onSeeded={load}
          />
        }
      />

      <CasesOverviewStats
        caseCount={cases.length}
        totalEvidenceFiles={totalEvidenceFiles}
        verificationCurrentCases={verificationCurrentCases}
        staleCaseCount={staleCaseCount}
        mismatchCount={mismatchCount}
        ledgerHealth={ledgerHealth}
      />

      {visibleCases.length === 0 ? (
        <EmptyStateCard
          title={showStaleOnly ? "No stale cases" : "No cases yet"}
          description={
            showStaleOnly
              ? "All case verifications are current, or there are no attachment-backed cases."
              : "Seed test data to validate list shape and route behavior."
          }
          action={<AddAttachmentButton />}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visibleCases.map(({ caseFile, caseItems, timelineEvents, hasAttachments, isStaleVerification }) => {
            const caseVerification = verificationByCaseId[caseFile.id];
            const caseExport = exportByCaseId[caseFile.id];
            const previewMessage = previewMessageByCaseId[caseFile.id];

            return (
              <CaseCard
                key={caseFile.id}
                caseFile={caseFile}
                caseItems={caseItems}
                timelineEvents={timelineEvents}
                hasAttachments={hasAttachments}
                isStaleVerification={isStaleVerification}
                caseVerification={caseVerification}
                caseExport={caseExport}
                previewMessage={previewMessage}
                dropTargetCaseId={dropTargetCaseId}
                onSetDropTargetCaseId={setDropTargetCaseId}
                onExportCaseReport={exportCaseReport}
                onCopyExportSummary={handleCopyExportSummary}
                onDownloadManifestPreview={handleDownloadManifestPreview}
                onVerifyCaseEvidence={verifyCaseEvidence}
                onHandleCaseDrop={handleCaseDrop}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
