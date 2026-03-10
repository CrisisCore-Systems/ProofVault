import type { CaseFile, ExportBundle } from "../../../domain/types";
import { EmptyStateCard } from "../../../components/ui/EmptyStateCard";
import { formatDisplayDateTime } from "../../../lib/dates/format";

type ExportHistoryPanelProps = {
  bundles: ExportBundle[];
  cases: CaseFile[];
};

export function ExportHistoryPanel({ bundles, cases }: Readonly<ExportHistoryPanelProps>) {
  return (
    <section className="pv-card space-y-4">
      <div>
        <h3 className="pv-section-title">Export history</h3>
        <p className="mt-1 text-sm text-zinc-400">Recent bundle manifests generated on this device.</p>
      </div>

      {bundles.length === 0 ? (
        <EmptyStateCard
          title="No export bundles"
          description="Generate the first ZIP packet to record an export manifest locally."
        />
      ) : (
        <ul className="space-y-2">
          {bundles.map((bundle) => {
            const caseTitle = cases.find((caseFile) => caseFile.id === bundle.caseId)?.title ?? bundle.caseId;

            return (
              <li key={bundle.id} className="rounded-md border border-zinc-800 bg-zinc-950/80 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">{caseTitle}</h3>
                    <p className="text-xs text-zinc-400">{bundle.mode} · {bundle.itemIds.length} items</p>
                    <div className="mt-2 space-y-1 text-xs text-zinc-500">
                      <p>Manifest: {bundle.manifestRef}</p>
                      <p>Archive: {bundle.archiveRef ?? "-"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">{formatDisplayDateTime(bundle.createdAt)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}