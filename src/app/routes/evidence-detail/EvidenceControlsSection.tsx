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

export function EvidenceControlsSection({
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