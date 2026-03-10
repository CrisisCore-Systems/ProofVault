import type { EvidenceItem } from "../../../domain/types";
import type { EvidenceDetailView } from "../../../features/evidence/evidenceDetailView";
import type { IntegrityVerificationResult } from "../../../features/evidence/integrity";
import { formatDisplayDateTime } from "../../../lib/dates/format";
import { formatSize, hashSnippet, integrityStatusLabel, integrityStatusStyle } from "./formatting";

type AttachmentMetadataSectionProps = {
  evidence: EvidenceItem;
  attachment?: EvidenceDetailView["attachment"];
  verifyingIntegrity: boolean;
  integrityResult: IntegrityVerificationResult | null;
  onVerifyIntegrity: () => void;
  onCopyHash: () => void;
  copyHashFeedback: string | null;
};

export function AttachmentMetadataSection({
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