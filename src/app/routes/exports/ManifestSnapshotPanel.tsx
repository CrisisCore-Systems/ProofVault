import { formatDisplayDateTime } from "../../../lib/dates/format";
import type { ExportPreviewManifest } from "../../../lib/export/exportBundle";

type ManifestSnapshotPanelProps = {
  manifest: ExportPreviewManifest | null;
};

export function ManifestSnapshotPanel({ manifest }: Readonly<ManifestSnapshotPanelProps>) {
  if (!manifest) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-950/80 p-4 text-xs text-zinc-500">
        Choose a case to inspect the manifest preview scope.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">Manifest snapshot</h4>
          <p className="mt-1 text-xs text-zinc-400">
            Current preflight scope for copy and download actions.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300">
          {manifest.options.mode}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Items</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{manifest.counts.includedItems}</p>
          <p className="text-xs text-zinc-500">{manifest.counts.excludedItems} excluded</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Attachments</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{manifest.counts.attachmentsIncluded}</p>
          <p className="text-xs text-zinc-500">{manifest.counts.attachmentsOmitted} omitted</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Metadata appendix</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">
            {manifest.options.includeMetadataAppendix ? "Included" : "Omitted"}
          </p>
          <p className="text-xs text-zinc-500">{manifest.options.includeAttachments ? "Attachments on" : "Attachments off"}</p>
        </div>
      </div>

      <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <p className="text-zinc-500">Case</p>
          <p className="mt-1 text-zinc-200">{manifest.case.title}</p>
          <p className="mt-1 text-zinc-500">{manifest.case.type} · {manifest.case.status}</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <p className="text-zinc-500">Date range</p>
          <p className="mt-1 text-zinc-200">
            {manifest.options.startDate ?? "Start"} → {manifest.options.endDate ?? "Latest"}
          </p>
          <p className="mt-1 text-zinc-500">Preview built {formatDisplayDateTime(manifest.generatedAt)}</p>
        </div>
      </div>
    </div>
  );
}