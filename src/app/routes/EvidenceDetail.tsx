import { type PointerEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getCaseById,
  getEvidenceItemById,
  getLatestLedgerEntryForAttachment,
  listEvidenceItemsForCase,
  updateEvidenceControls,
  updateEvidenceRedactions,
} from "../../db/queries";
import type { EvidenceItem, LedgerEntry, RedactionRegion } from "../../domain/types";
import type { EvidenceDetailView } from "../../features/evidence/evidenceDetailView";
import {
  type IntegrityVerificationResult,
  verifyEvidenceIntegrity,
} from "../../features/evidence/integrity";
import { appendLedgerEvent } from "../../features/ledger/chain";
import { formatDisplayDateTime } from "../../lib/dates/format";
import { bakeRedactedImage } from "../../lib/utils/redactionBake";
import { useVault } from "../../features/vault/VaultContext";
import { loadDecryptedAttachmentByEvidenceItemId } from "../../features/vault/attachmentCrypto";

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const kib = sizeBytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }

  const mib = kib / 1024;
  return `${mib.toFixed(1)} MB`;
}

function hashSnippet(hash?: string): string {
  if (!hash) {
    return "-";
  }

  if (hash.length <= 24) {
    return hash;
  }

  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundPercentage(value: number): number {
  return Math.round(clampPercentage(value) * 1000) / 1000;
}

function buildRegionFromPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Omit<RedactionRegion, "id"> {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  return {
    x: roundPercentage(x),
    y: roundPercentage(y),
    width: roundPercentage(width),
    height: roundPercentage(height),
  };
}

function integrityStatusStyle(status: IntegrityVerificationResult["status"]): string {
  if (status === "verified") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "mismatch") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function integrityStatusLabel(status: IntegrityVerificationResult["status"]): string {
  if (status === "verified") {
    return "✔ Verified";
  }

  if (status === "mismatch") {
    return "⚠ Hash mismatch";
  }

  return "Unverifiable";
}

async function fetchEvidenceDetailView(
  evidenceId: string,
  key: CryptoKey | null
): Promise<EvidenceDetailView | null> {
  const evidence = await getEvidenceItemById(evidenceId);
  if (!evidence) {
    return null;
  }

  const attachment = await loadDecryptedAttachmentByEvidenceItemId(evidence.id, key);
  const caseFile = evidence.caseId ? await getCaseById(evidence.caseId) : undefined;

  let linkedIncident: EvidenceItem | undefined;
  if (evidence.caseId) {
    const related = await listEvidenceItemsForCase(evidence.caseId);
    linkedIncident = related.find((item) => item.kind === "incident" && item.id !== evidence.id);
  }

  return { evidence, attachment, caseFile, linkedIncident };
}

type AttachmentViewerProps = {
  evidence: EvidenceItem;
  attachmentFilename: string;
  blobUrl: string;
};

function AttachmentViewer({ evidence, attachmentFilename, blobUrl }: Readonly<AttachmentViewerProps>) {
  return (
    <div className="space-y-3">
      {evidence.mimeType?.startsWith("image/") ? (
        <img src={blobUrl} alt={evidence.title} className="max-h-[360px] rounded-md border border-zinc-800 object-contain" />
      ) : null}

      {evidence.mimeType?.startsWith("audio/") ? (
        <audio controls src={blobUrl} className="w-full">
          <track kind="captions" />
        </audio>
      ) : null}

      {evidence.mimeType?.startsWith("video/") ? (
        <video controls src={blobUrl} className="max-h-[360px] w-full rounded-md border border-zinc-800">
          <track kind="captions" />
        </video>
      ) : null}

      {evidence.mimeType === "application/pdf" ? (
        <button
          type="button"
          onClick={() => window.open(blobUrl, "_blank", "noopener,noreferrer")}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Open PDF
        </button>
      ) : null}

      <a
        href={blobUrl}
        download={attachmentFilename}
        className="inline-block rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Download original file
      </a>
    </div>
  );
}

type AttachmentMetadataSectionProps = {
  evidence: EvidenceItem;
  attachment?: EvidenceDetailView["attachment"];
  verifyingIntegrity: boolean;
  integrityResult: IntegrityVerificationResult | null;
  onVerifyIntegrity: () => void;
  onCopyHash: () => void;
  copyHashFeedback: string | null;
};

function AttachmentMetadataSection({
  evidence,
  attachment,
  verifyingIntegrity,
  integrityResult,
  onVerifyIntegrity,
  onCopyHash,
  copyHashFeedback,
}: Readonly<AttachmentMetadataSectionProps>) {
  return (
    <section className="pv-card space-y-3">
      <h3 className="pv-section-title">Attachment Metadata</h3>
      <dl className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">File name</dt>
          <dd>{evidence.originalFilename ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">MIME type</dt>
          <dd>{evidence.mimeType ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">File size</dt>
          <dd>{attachment ? `${formatSize(attachment.sizeBytes)} (${attachment.sizeBytes} bytes)` : "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">SHA-256 hash</dt>
          <dd>{hashSnippet(evidence.sha256)}</dd>
        </div>
      </dl>
      {evidence.sha256 ? (
        <div className="text-xs text-zinc-500">
          <p>Full hash: {evidence.sha256}</p>
          <button
            type="button"
            onClick={onCopyHash}
            className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Copy
          </button>
          {copyHashFeedback ? <p className="mt-1 text-emerald-300">{copyHashFeedback}</p> : null}
        </div>
      ) : null}

      <div className="pt-2">
        <button
          type="button"
          onClick={onVerifyIntegrity}
          disabled={verifyingIntegrity}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifyingIntegrity ? "Verifying..." : "Verify Integrity"}
        </button>
      </div>

      {integrityResult ? (
        <div className={`rounded-md border px-3 py-2 text-sm ${integrityStatusStyle(integrityResult.status)}`}>
          <p className="font-medium">Integrity Status: {integrityStatusLabel(integrityResult.status)}</p>
          <p className="mt-1">{integrityResult.details}</p>
          <p className="mt-1 text-xs">Checked: {formatDisplayDateTime(integrityResult.checkedAt)}</p>
          {integrityResult.recomputedSha256 ? (
            <p className="mt-1 text-xs">Recomputed hash: {hashSnippet(integrityResult.recomputedSha256)}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type TimeMetadataSectionProps = {
  evidence: EvidenceItem;
};

function TimeMetadataSection({ evidence }: Readonly<TimeMetadataSectionProps>) {
  return (
    <section className="pv-card space-y-3">
      <h3 className="pv-section-title">Time Metadata</h3>
      <dl className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Occurred</dt>
          <dd>{evidence.occurredAt ? formatDisplayDateTime(evidence.occurredAt) : "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Recorded</dt>
          <dd>{formatDisplayDateTime(evidence.recordedAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Imported</dt>
          <dd>{evidence.importedAt ? formatDisplayDateTime(evidence.importedAt) : "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Created</dt>
          <dd>{formatDisplayDateTime(evidence.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Updated</dt>
          <dd>{formatDisplayDateTime(evidence.updatedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

type RelationshipsSectionProps = {
  caseFile?: EvidenceDetailView["caseFile"];
  linkedIncident?: EvidenceItem;
  attachment?: EvidenceDetailView["attachment"];
};

function RelationshipsSection({ caseFile, linkedIncident, attachment }: Readonly<RelationshipsSectionProps>) {
  return (
    <section className="pv-card space-y-3">
      <h3 className="pv-section-title">Relationships</h3>
      <p className="text-sm text-zinc-300">
        Case:{" "}
        {caseFile ? (
          <Link to="/cases" className="text-emerald-300 hover:text-emerald-200">
            {caseFile.title}
          </Link>
        ) : (
          "unassigned"
        )}
      </p>
      <p className="text-sm text-zinc-300">
        Linked Incident:{" "}
        {linkedIncident ? (
          <Link to={`/evidence/${linkedIncident.id}`} className="text-emerald-300 hover:text-emerald-200">
            {linkedIncident.title}
          </Link>
        ) : (
          "not linked"
        )}
      </p>
      {attachment ? <p className="text-xs text-zinc-500">Attachment ID: {attachment.id}</p> : null}
    </section>
  );
}

type AttachmentSectionProps = {
  evidence: EvidenceItem;
  attachment?: EvidenceDetailView["attachment"];
  blobUrl: string | null;
  redactions: RedactionRegion[];
  redactMode: boolean;
  savingRedactions: boolean;
  redactionFeedback: string | null;
  hasPendingRedactionChanges: boolean;
  onToggleRedactMode: () => void;
  onChangeRedactions: (value: RedactionRegion[]) => void;
  onSaveRedactions: () => void;
};

type ImageAttachmentRedactionEditorProps = {
  evidence: EvidenceItem;
  attachment: NonNullable<EvidenceDetailView["attachment"]>;
  blobUrl: string;
  redactions: RedactionRegion[];
  redactMode: boolean;
  savingRedactions: boolean;
  redactionFeedback: string | null;
  hasPendingRedactionChanges: boolean;
  onToggleRedactMode: () => void;
  onChangeRedactions: (value: RedactionRegion[]) => void;
  onSaveRedactions: () => void;
};

function ImageAttachmentRedactionEditor({
  evidence,
  attachment,
  blobUrl,
  redactions,
  redactMode,
  savingRedactions,
  redactionFeedback,
  hasPendingRedactionChanges,
  onToggleRedactMode,
  onChangeRedactions,
  onSaveRedactions,
}: Readonly<ImageAttachmentRedactionEditorProps>) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draftRegion, setDraftRegion] = useState<Omit<RedactionRegion, "id"> | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!redactMode) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const startX = roundPercentage(((event.clientX - bounds.left) / bounds.width) * 100);
    const startY = roundPercentage(((event.clientY - bounds.top) / bounds.height) * 100);

    setDragStart({ x: startX, y: startY });
    setDraftRegion({ x: startX, y: startY, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!redactMode || !dragStart) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const currentX = roundPercentage(((event.clientX - bounds.left) / bounds.width) * 100);
    const currentY = roundPercentage(((event.clientY - bounds.top) / bounds.height) * 100);
    setDraftRegion(buildRegionFromPoints(dragStart.x, dragStart.y, currentX, currentY));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!redactMode || !dragStart || !draftRegion) {
      return;
    }

    const minimumPercent = 0.5;
    if (draftRegion.width >= minimumPercent && draftRegion.height >= minimumPercent) {
      onChangeRedactions([
        ...redactions,
        {
          id: crypto.randomUUID(),
          ...draftRegion,
        },
      ]);
    }

    setDragStart(null);
    setDraftRegion(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const clearAllRedactions = () => {
    onChangeRedactions([]);
  };

  const undoLastRedaction = () => {
    onChangeRedactions(redactions.slice(0, -1));
  };

  return (
    <div className="space-y-3">
      <div className="relative inline-block overflow-hidden rounded-md border border-zinc-800">
        <img src={blobUrl} alt={evidence.title} className="block max-h-[420px] max-w-full select-none object-contain" />

        <div
          className={[
            "absolute inset-0",
            redactMode ? "cursor-crosshair" : "pointer-events-none",
          ].join(" ")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {redactions.map((region) => (
            <div
              key={region.id}
              className="absolute border border-yellow-500/80 bg-black/95"
              style={{
                left: `${region.x}%`,
                top: `${region.y}%`,
                width: `${region.width}%`,
                height: `${region.height}%`,
              }}
            />
          ))}

          {draftRegion ? (
            <div
              className="absolute border border-yellow-300 bg-black/70"
              style={{
                left: `${draftRegion.x}%`,
                top: `${draftRegion.y}%`,
                width: `${draftRegion.width}%`,
                height: `${draftRegion.height}%`,
              }}
            />
          ) : null}
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {redactMode
          ? "Redact mode active: click and drag over sensitive areas to add black overlays."
          : "Toggle redact mode to add non-destructive redaction overlays."}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleRedactMode}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          {redactMode ? "Exit Redact Mode" : "Enter Redact Mode"}
        </button>

        <button
          type="button"
          disabled={redactions.length === 0}
          onClick={undoLastRedaction}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Undo Last
        </button>

        <button
          type="button"
          disabled={redactions.length === 0}
          onClick={clearAllRedactions}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear All
        </button>

        <button
          type="button"
          disabled={savingRedactions || !hasPendingRedactionChanges}
          onClick={onSaveRedactions}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingRedactions ? "Saving..." : "Save Redactions"}
        </button>
      </div>

      <p className="text-xs text-zinc-500">Saved overlays: {redactions.length}</p>
      {redactionFeedback ? <p className="text-sm text-emerald-300">{redactionFeedback}</p> : null}

      <a
        href={blobUrl}
        download={attachment.originalFilename}
        className="inline-block rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Download original file
      </a>
    </div>
  );
}

function AttachmentSection({
  evidence,
  attachment,
  blobUrl,
  redactions,
  redactMode,
  savingRedactions,
  redactionFeedback,
  hasPendingRedactionChanges,
  onToggleRedactMode,
  onChangeRedactions,
  onSaveRedactions,
}: Readonly<AttachmentSectionProps>) {
  const isImageAttachment = Boolean(attachment && blobUrl && evidence.mimeType?.startsWith("image/"));

  let attachmentContent: ReactNode;
  if (!attachment || !blobUrl) {
    attachmentContent = (
      <p className="text-sm text-zinc-500">No attachment blob linked to this evidence item.</p>
    );
  } else if (isImageAttachment) {
    attachmentContent = (
      <ImageAttachmentRedactionEditor
        evidence={evidence}
        attachment={attachment}
        blobUrl={blobUrl}
        redactions={redactions}
        redactMode={redactMode}
        savingRedactions={savingRedactions}
        redactionFeedback={redactionFeedback}
        hasPendingRedactionChanges={hasPendingRedactionChanges}
        onToggleRedactMode={onToggleRedactMode}
        onChangeRedactions={onChangeRedactions}
        onSaveRedactions={onSaveRedactions}
      />
    );
  } else {
    attachmentContent = (
      <AttachmentViewer
        evidence={evidence}
        attachmentFilename={attachment.originalFilename}
        blobUrl={blobUrl}
      />
    );
  }

  return (
    <section className="pv-card space-y-3">
      <h3 className="pv-section-title">Attachment</h3>
      {attachmentContent}
    </section>
  );
}

type EvidenceProvenanceCertificateProps = {
  evidence: EvidenceItem;
  attachment?: EvidenceDetailView["attachment"];
  ledgerEntry: LedgerEntry | null;
  certificateImageUrl: string | null;
  derivativeHash: string | null;
  derivativePreparedAt: string | null;
  isRedactedDerivative: boolean;
};

function EvidenceProvenanceCertificate({
  evidence,
  attachment,
  ledgerEntry,
  certificateImageUrl,
  derivativeHash,
  derivativePreparedAt,
  isRedactedDerivative,
}: Readonly<EvidenceProvenanceCertificateProps>) {
  return (
    <section className="hidden bg-white p-6 font-mono text-sm text-black [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:block print:p-8">
      <div className="mb-6 border-b-2 border-black pb-4 print:break-inside-avoid">
        <h1 className="text-2xl font-bold uppercase tracking-widest">Evidence Provenance Certificate</h1>
        <p>Generated by ProofVault | Cryptographic Integrity Log</p>
      </div>

      {isRedactedDerivative ? (
        <div className="mb-6 border-2 border-black bg-gray-200 px-3 py-2 font-bold tracking-wide print:break-inside-avoid">
          REDACTED DERIVATIVE COPY
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-8">
        <div className="print:break-inside-avoid">
          <h2 className="mb-2 border-b border-gray-300 font-bold">Artifact Details</h2>
          <p>
            <strong>File Name:</strong> {attachment?.originalFilename ?? evidence.originalFilename ?? "-"}
          </p>
          <p>
            <strong>MIME Type:</strong> {attachment?.mimeType ?? evidence.mimeType ?? "-"}
          </p>
          <p>
            <strong>Size:</strong> {attachment ? `${formatSize(attachment.sizeBytes)} (${attachment.sizeBytes} bytes)` : "-"}
          </p>
          <p>
            <strong>Recorded At:</strong> {new Date(evidence.recordedAt).toUTCString()}
          </p>
        </div>

        <div className="print:break-inside-avoid">
          <h2 className="mb-2 border-b border-gray-300 font-bold">Cryptographic Fingerprint</h2>
          <p>
            <strong>Algorithm:</strong> SHA-256
          </p>
          {isRedactedDerivative ? (
            <>
              <p className="break-all break-words">
                <strong>Original SHA-256:</strong> {evidence.sha256 ?? "-"}
              </p>
              <p className="break-all break-words">
                <strong>Derivative SHA-256:</strong> {derivativeHash ?? "Preparing..."}
              </p>
              <p>
                <strong>Derivative Prepared:</strong> {derivativePreparedAt ? new Date(derivativePreparedAt).toUTCString() : "-"}
              </p>
            </>
          ) : (
            <p className="break-all break-words">
              <strong>Digest:</strong> {evidence.sha256 ?? "-"}
            </p>
          )}
        </div>
      </div>

      {certificateImageUrl ? (
        <div className="mb-8 print:break-inside-avoid">
          <h2 className="mb-2 border-b border-gray-300 font-bold">
            {isRedactedDerivative ? "Flattened Redacted Artifact" : "Artifact Preview"}
          </h2>
          <img src={certificateImageUrl} alt="Certificate artifact" className="max-h-[480px] w-auto border border-gray-400 object-contain" />
        </div>
      ) : null}

      <div className="mb-8 print:break-inside-avoid">
        <h2 className="mb-2 border-b border-gray-300 font-bold">Chain of Custody (Ledger Anchor)</h2>
        <p>
          <strong>Ledger Entry ID:</strong> {ledgerEntry?.id ?? "Pending"}
        </p>
        <p>
          <strong>Event Type:</strong> {ledgerEntry?.event ?? "Pending"}
        </p>
        <p className="break-all break-words">
          <strong>Chain Hash:</strong> {ledgerEntry?.hash ?? "N/A"}
        </p>
      </div>

      <div className="mt-12 border-t border-gray-300 pt-4 text-center text-xs text-gray-500">
        <p>This certificate proves the existence and integrity of the attached file at the specified time.</p>
        <p>Any modification to the original file will result in a mismatch of the SHA-256 digest.</p>
      </div>
    </section>
  );
}

type EvidenceControlsSectionProps = {
  includeInExport: boolean;
  redacted: boolean;
  description: string;
  savingControls: boolean;
  savedFeedback: string | null;
  onChangeIncludeInExport: (value: boolean) => void;
  onChangeRedacted: (value: boolean) => void;
  onChangeDescription: (value: string) => void;
  onSaveControls: () => void;
};

function EvidenceControlsSection({
  includeInExport,
  redacted,
  description,
  savingControls,
  savedFeedback,
  onChangeIncludeInExport,
  onChangeRedacted,
  onChangeDescription,
  onSaveControls,
}: Readonly<EvidenceControlsSectionProps>) {
  return (
    <section className="pv-card space-y-3">
      <h3 className="pv-section-title">Evidence Controls</h3>

      <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={includeInExport}
          onChange={(event) => onChangeIncludeInExport(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
        />
        <span>Include in export</span>
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={redacted}
          onChange={(event) => onChangeRedacted(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
        />
        <span>Mark as redacted</span>
      </label>

      <label className="block text-sm text-zinc-200">
        <span className="mb-1 block">Description</span>
        <textarea
          value={description}
          onChange={(event) => onChangeDescription(event.target.value)}
          rows={5}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
        />
      </label>

      {savedFeedback ? <p className="text-sm text-emerald-300">{savedFeedback}</p> : null}

      <button
        type="button"
        disabled={savingControls}
        onClick={onSaveControls}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {savingControls ? "Saving..." : "Save Controls"}
      </button>
    </section>
  );
}

export function EvidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const { sessionKey } = useVault();
  const [view, setView] = useState<EvidenceDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [includeInExport, setIncludeInExport] = useState(true);
  const [redacted, setRedacted] = useState(false);
  const [savingControls, setSavingControls] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [integrityResult, setIntegrityResult] = useState<IntegrityVerificationResult | null>(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [copyHashFeedback, setCopyHashFeedback] = useState<string | null>(null);
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntry | null>(null);
  const [redactions, setRedactions] = useState<RedactionRegion[]>([]);
  const [redactMode, setRedactMode] = useState(false);
  const [savingRedactions, setSavingRedactions] = useState(false);
  const [redactionFeedback, setRedactionFeedback] = useState<string | null>(null);
  const [preparingCertificate, setPreparingCertificate] = useState(false);
  const [certificateImageUrl, setCertificateImageUrl] = useState<string | null>(null);
  const [derivativeHash, setDerivativeHash] = useState<string | null>(null);
  const [derivativePreparedAt, setDerivativePreparedAt] = useState<string | null>(null);

  const loadDetail = async (evidenceId: string) => {
    setLoading(true);
    setErrorMessage(null);

    const detailView = await fetchEvidenceDetailView(evidenceId, sessionKey);
    if (!detailView) {
      setView(null);
      setLedgerEntry(null);
      setLoading(false);
      setErrorMessage("Evidence item not found");
      return;
    }

    const attachmentLedgerEntry = detailView.attachment
      ? await getLatestLedgerEntryForAttachment(detailView.attachment.id)
      : undefined;

    setView(detailView);
    setLedgerEntry(attachmentLedgerEntry ?? null);
    setDescription(detailView.evidence.description ?? "");
    setIncludeInExport(detailView.evidence.includeInExport);
    setRedacted(detailView.evidence.redactionStatus !== "none");
    setRedactions(detailView.evidence.redactions ?? []);
    setRedactMode(false);
    setRedactionFeedback(null);
    resetCertificateDerivative();
    setIntegrityResult(null);
    setCopyHashFeedback(null);
    setLoading(false);
  };

  useEffect(() => {
    if (!id) {
      setErrorMessage("Missing evidence id");
      setLoading(false);
      return;
    }

    void loadDetail(id);
  }, [id]);

  const blobUrl = useMemo(() => {
    if (!view?.attachment) {
      return null;
    }

    return URL.createObjectURL(view.attachment.blob);
  }, [view?.attachment]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  useEffect(() => {
    return () => {
      if (certificateImageUrl) {
        URL.revokeObjectURL(certificateImageUrl);
      }
    };
  }, [certificateImageUrl]);

  const resetCertificateDerivative = () => {
    setCertificateImageUrl((existing) => {
      if (existing) {
        URL.revokeObjectURL(existing);
      }
      return null;
    });
    setDerivativeHash(null);
    setDerivativePreparedAt(null);
  };

  const handleSaveControls = async () => {
    if (!view) {
      return;
    }

    setSavingControls(true);
    setSavedFeedback(null);

    try {
      await updateEvidenceControls(view.evidence.id, {
        includeInExport,
        redactionStatus: redacted ? "partial" : "none",
        description: description.trim() || undefined,
      });
      await loadDetail(view.evidence.id);
      setSavedFeedback("Evidence controls saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save evidence controls");
    } finally {
      setSavingControls(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!view) {
      return;
    }

    setVerifyingIntegrity(true);
    setIntegrityResult(null);

    try {
      const result = await verifyEvidenceIntegrity(view.evidence, view.attachment);
      setIntegrityResult(result);
    } catch (error) {
      setIntegrityResult({
        status: "unverifiable",
        checkedAt: new Date().toISOString(),
        details: error instanceof Error ? error.message : "Integrity verification failed",
      });
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  const handleCopyHash = async () => {
    if (!view?.evidence.sha256) {
      return;
    }

    try {
      await navigator.clipboard.writeText(view.evidence.sha256);
      setCopyHashFeedback("Hash copied to clipboard.");
    } catch {
      setCopyHashFeedback("Unable to copy hash.");
    }
  };

  const handleSaveRedactions = async () => {
    if (!view) {
      return;
    }

    setSavingRedactions(true);
    setRedactionFeedback(null);

    try {
      await updateEvidenceRedactions(view.evidence.id, redactions);
      await appendLedgerEvent({
        event: "EVIDENCE_REDACTED",
        caseId: view.evidence.caseId,
        attachmentId: view.attachment?.id,
        data: {
          evidenceItemId: view.evidence.id,
          regions: redactions,
        },
      });
      await loadDetail(view.evidence.id);
      setRedactionFeedback("Redaction overlays saved and anchored to ledger.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save redactions");
    } finally {
      setSavingRedactions(false);
    }
  };

  const waitForNextPaint = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  };

  const prepareCertificateAndPrint = async () => {
    if (!view) {
      return;
    }

    if (hasPendingRedactionChanges) {
      setErrorMessage("Save redactions before generating a certificate.");
      return;
    }

    const savedRedactions = view.evidence.redactions ?? [];
    const attachmentForBake = view.attachment;
    const canBakeDerivative = Boolean(
      attachmentForBake &&
      view.evidence.mimeType?.startsWith("image/") &&
      savedRedactions.length > 0
    );

    if (!canBakeDerivative) {
      resetCertificateDerivative();
      await waitForNextPaint();
      globalThis.print();
      return;
    }

    setPreparingCertificate(true);
    setErrorMessage(null);

    try {
      if (!attachmentForBake) {
        throw new Error("Missing attachment for derivative generation");
      }

      const { bakedBlob, bakedHash } = await bakeRedactedImage(attachmentForBake.blob, savedRedactions);
      const bakedUrl = URL.createObjectURL(bakedBlob);

      const imagePreload = new Image();
      await new Promise<void>((resolve, reject) => {
        imagePreload.onload = () => resolve();
        imagePreload.onerror = () => reject(new Error("Unable to prepare derivative preview"));
        imagePreload.src = bakedUrl;
      });

      setCertificateImageUrl((existing) => {
        if (existing) {
          URL.revokeObjectURL(existing);
        }
        return bakedUrl;
      });
      setDerivativeHash(bakedHash);
      setDerivativePreparedAt(new Date().toISOString());

      await waitForNextPaint();
      globalThis.print();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to prepare redacted derivative");
    } finally {
      setPreparingCertificate(false);
    }
  };

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
  const hasPendingRedactionChanges =
    JSON.stringify(redactions) !== JSON.stringify(view.evidence.redactions ?? []);
  const hasSavedRedactions = (view.evidence.redactions?.length ?? 0) > 0;
  const canGenerateDerivativeCertificate = Boolean(
    attachment &&
    evidence.mimeType?.startsWith("image/") &&
    hasSavedRedactions
  );
  const effectiveCertificateImageUrl =
    certificateImageUrl ?? (evidence.mimeType?.startsWith("image/") ? blobUrl : null);

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
          onToggleRedactMode={() => setRedactMode((value) => !value)}
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
