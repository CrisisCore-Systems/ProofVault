import { Link, useParams } from "react-router-dom";
import { useEvidenceDetail } from "../../features/evidence/useEvidenceDetail";
import { AttachmentMetadataSection } from "./evidence-detail/AttachmentMetadataSection";
import { AttachmentSection } from "./evidence-detail/AttachmentSection";
import { EvidenceControlsSection } from "./evidence-detail/EvidenceControlsSection";
import { EvidenceProvenanceCertificate } from "./evidence-detail/EvidenceProvenanceCertificate";
import { RelationshipsSection } from "./evidence-detail/RelationshipsSection";
import { TimeMetadataSection } from "./evidence-detail/TimeMetadataSection";

export function EvidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const {
    view,
    loading,
    errorMessage,
    description,
    setDescription,
    includeInExport,
    setIncludeInExport,
    redacted,
    setRedacted,
    savingControls,
    savedFeedback,
    integrityResult,
    verifyingIntegrity,
    copyHashFeedback,
    ledgerEntry,
    redactions,
    setRedactions,
    redactMode,
    toggleRedactMode,
    savingRedactions,
    redactionFeedback,
    preparingCertificate,
    derivativeHash,
    derivativePreparedAt,
    blobUrl,
    effectiveCertificateImageUrl,
    hasPendingRedactionChanges,
    canGenerateDerivativeCertificate,
    handleSaveControls,
    handleVerifyIntegrity,
    handleCopyHash,
    handleSaveRedactions,
    prepareCertificateAndPrint,
  } = useEvidenceDetail(id);

  if (loading) {
    return <section className="pv-card">Loading evidence detail...</section>;
  }

  if (errorMessage || !view) {
    return (
      <section className="space-y-3">
        <div className="pv-card text-sm text-red-300">{errorMessage ?? "Evidence not found"}</div>
        <Link to="/inbox" className="text-sm text-emerald-300 hover:text-emerald-200">
          Back to Inbox
        </Link>
      </section>
    );
  }

  const { evidence, attachment, caseFile, linkedIncident } = view;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 print:max-w-none print:space-y-0">
      <div className="space-y-4 print:hidden">
        <header className="pv-card">
          <h2 className="text-lg font-semibold text-zinc-100">{evidence.title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{evidence.kind}</p>
          <p className="mt-1 text-xs text-zinc-500">Evidence ID: {evidence.id}</p>
          <div className="mt-3">
            <button
              type="button"
              disabled={preparingCertificate}
              onClick={() => void prepareCertificateAndPrint()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {preparingCertificate ? "Baking derivative..." : "Generate Certificate (PDF)"}
            </button>
          </div>
          {canGenerateDerivativeCertificate ? (
            <p className="mt-2 text-xs text-zinc-500">
              Certificate prints as redacted derivative with original and derivative SHA-256 values.
            </p>
          ) : null}
        </header>

        <AttachmentMetadataSection
          evidence={evidence}
          attachment={attachment}
          verifyingIntegrity={verifyingIntegrity}
          integrityResult={integrityResult}
          onVerifyIntegrity={() => void handleVerifyIntegrity()}
          onCopyHash={() => void handleCopyHash()}
          copyHashFeedback={copyHashFeedback}
        />

        <TimeMetadataSection evidence={evidence} />

        <RelationshipsSection caseFile={caseFile} linkedIncident={linkedIncident} attachment={attachment} />

        <AttachmentSection
          evidence={evidence}
          attachment={attachment}
          blobUrl={blobUrl}
          redactions={redactions}
          redactMode={redactMode}
          savingRedactions={savingRedactions}
          redactionFeedback={redactionFeedback}
          hasPendingRedactionChanges={hasPendingRedactionChanges}
          onToggleRedactMode={toggleRedactMode}
          onChangeRedactions={setRedactions}
          onSaveRedactions={() => void handleSaveRedactions()}
        />

        <EvidenceControlsSection
          includeInExport={includeInExport}
          redacted={redacted}
          description={description}
          savingControls={savingControls}
          savedFeedback={savedFeedback}
          onChangeIncludeInExport={setIncludeInExport}
          onChangeRedacted={setRedacted}
          onChangeDescription={setDescription}
          onSaveControls={() => void handleSaveControls()}
        />
      </div>

      <EvidenceProvenanceCertificate
        evidence={evidence}
        attachment={attachment}
        ledgerEntry={ledgerEntry}
        certificateImageUrl={effectiveCertificateImageUrl}
        derivativeHash={derivativeHash}
        derivativePreparedAt={derivativePreparedAt}
        isRedactedDerivative={canGenerateDerivativeCertificate}
      />
    </section>
  );
}
