import type { ComponentProps } from "react";
import type { CaseFile, ExportBundle } from "../../../domain/types";

type ExportPacketFormProps = {
  cases: CaseFile[];
  selectedCaseId: string;
  mode: ExportBundle["mode"];
  startDate: string;
  endDate: string;
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
  exportableItemsCount: number;
  attachmentCandidates: number;
  exporting: boolean;
  exportError: string | null;
  exportSuccess: string | null;
  onSubmit: ComponentProps<"form">["onSubmit"];
  onSelectCase: (value: string) => void;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
  onSelectMode: (value: ExportBundle["mode"]) => void;
  onToggleAttachments: (value: boolean) => void;
  onToggleMetadataAppendix: (value: boolean) => void;
};

export function ExportPacketForm({
  cases,
  selectedCaseId,
  mode,
  startDate,
  endDate,
  includeAttachments,
  includeMetadataAppendix,
  exportableItemsCount,
  attachmentCandidates,
  exporting,
  exportError,
  exportSuccess,
  onSubmit,
  onSelectCase,
  onChangeStartDate,
  onChangeEndDate,
  onSelectMode,
  onToggleAttachments,
  onToggleMetadataAppendix,
}: Readonly<ExportPacketFormProps>) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm text-zinc-200">
        <span className="mb-1 block">Case</span>
        <select
          value={selectedCaseId}
          onChange={(event) => onSelectCase(event.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
        >
          {cases.map((caseFile) => (
            <option key={caseFile.id} value={caseFile.id}>
              {caseFile.title}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onChangeStartDate(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          />
        </label>

        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onChangeEndDate(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          />
        </label>
      </div>

      <div className="space-y-2">
        <span className="block text-sm text-zinc-200">Mode</span>
        <div className="flex flex-wrap gap-2">
          {[{ value: "redacted", label: "Redacted" }, { value: "full", label: "Full" }].map((option) => {
            const selected = mode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelectMode(option.value as ExportBundle["mode"])}
                className={[
                  "rounded-full border px-3 py-2 text-sm transition",
                  selected
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(event) => onToggleAttachments(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
          />
          <span>Include attachments</span>
        </label>

        <label className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={includeMetadataAppendix}
            onChange={(event) => onToggleMetadataAppendix(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
          />
          <span>Include metadata appendix</span>
        </label>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-xs text-zinc-400">
        <p>Output format: ZIP only in v0.1.</p>
        <p className="mt-1">Preview: {exportableItemsCount} export-ready items, {attachmentCandidates} attachment candidates.</p>
        <p className="mt-1">Redacted mode omits fully redacted files and unsupported redacted non-image attachments.</p>
      </div>

      {exportError ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {exportError}
        </p>
      ) : null}

      {exportSuccess ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {exportSuccess}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={exporting}
          className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? "Generating..." : "Generate ZIP Export"}
        </button>
      </div>
    </form>
  );
}