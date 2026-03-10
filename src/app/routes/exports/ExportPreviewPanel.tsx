import { formatDisplayDateTime } from "../../../lib/dates/format";
import type { ExportPreviewItem } from "../../../lib/export/exportBundle";

type ExportPreviewPanelProps = {
  previewItems: ExportPreviewItem[];
};

export function ExportPreviewPanel({ previewItems }: Readonly<ExportPreviewPanelProps>) {
  const includedPreviewItems = previewItems.filter((item) => item.included);
  const excludedPreviewItems = previewItems.filter((item) => !item.included);

  return (
    <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">Live export preview</h4>
          <p className="mt-1 text-xs text-zinc-400">
            Review which items will be included and how attachments will be handled before generating the ZIP.
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>Included: {includedPreviewItems.length}</p>
          <p>Excluded: {excludedPreviewItems.length}</p>
        </div>
      </div>

      {previewItems.length === 0 ? (
        <p className="text-xs text-zinc-500">Choose a case to preview export contents.</p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Included items</p>
            {includedPreviewItems.length === 0 ? (
              <p className="text-xs text-zinc-500">No items will be included with the current filters.</p>
            ) : (
              <ul className="space-y-2">
                {includedPreviewItems.slice(0, 6).map((item) => (
                  <li key={item.id} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-emerald-200">{item.title}</p>
                        <p className="mt-1 text-zinc-400">{item.kind} · {formatDisplayDateTime(item.timestamp)}</p>
                        <p className="mt-1 text-zinc-400">{item.selectionReason}</p>
                        <p className="mt-1 text-zinc-500">{item.attachmentReason}</p>
                      </div>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                        {item.attachmentDisposition === "included" ? "attachment included" : item.attachmentDisposition}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Excluded items</p>
            {excludedPreviewItems.length === 0 ? (
              <p className="text-xs text-zinc-500">No items are currently excluded.</p>
            ) : (
              <ul className="space-y-2">
                {excludedPreviewItems.slice(0, 4).map((item) => (
                  <li key={item.id} className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs">
                    <p className="font-semibold text-zinc-200">{item.title}</p>
                    <p className="mt-1 text-zinc-400">{item.kind} · {formatDisplayDateTime(item.timestamp)}</p>
                    <p className="mt-1 text-zinc-500">{item.selectionReason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}