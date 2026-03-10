type ExportPreflightActionsProps = {
  previewActionMessage: string | null;
  onCopySummary: () => Promise<void>;
  onDownloadManifestPreview: () => void;
};

export function ExportPreflightActions({
  previewActionMessage,
  onCopySummary,
  onDownloadManifestPreview,
}: Readonly<ExportPreflightActionsProps>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onCopySummary()}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
      >
        Copy Summary
      </button>
      <button
        type="button"
        onClick={onDownloadManifestPreview}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
      >
        Download Manifest Preview
      </button>
      {previewActionMessage ? <span className="text-xs text-zinc-400">{previewActionMessage}</span> : null}
    </div>
  );
}