import type { EvidenceItem } from "../../../domain/types";
import { formatDisplayDateTime } from "../../../lib/dates/format";

type TimeMetadataSectionProps = {
  evidence: EvidenceItem;
};

export function TimeMetadataSection({ evidence }: Readonly<TimeMetadataSectionProps>) {
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