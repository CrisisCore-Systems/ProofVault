import { useMemo } from "react";
import type { ExportBundle } from "../../../domain/types";
import {
  DEFAULT_REDACTED_EXPORT_SETTINGS,
  FULL_ARCHIVE_EXPORT_SETTINGS,
  SUMMARY_REVIEW_EXPORT_SETTINGS,
} from "../../../features/exports/config";

export type ExportPreset = {
  id: string;
  label: string;
  description: string;
  mode: ExportBundle["mode"];
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
};

export const exportPresets: ExportPreset[] = [
  {
    id: "court-ready",
    label: "Court-ready redacted",
    description: "Redacted ZIP with attachments and metadata appendix.",
    ...DEFAULT_REDACTED_EXPORT_SETTINGS,
  },
  {
    id: "summary-review",
    label: "Summary review packet",
    description: "Redacted ZIP without attachments for easier sharing or review.",
    ...SUMMARY_REVIEW_EXPORT_SETTINGS,
  },
  {
    id: "internal-archive",
    label: "Full internal archive",
    description: "Full ZIP with attachments and metadata appendix for local retention.",
    ...FULL_ARCHIVE_EXPORT_SETTINGS,
  },
];

type ExportPresetPickerProps = {
  mode: ExportBundle["mode"];
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
  onApplyPreset: (preset: ExportPreset) => void;
};

export function ExportPresetPicker({
  mode,
  includeAttachments,
  includeMetadataAppendix,
  onApplyPreset,
}: Readonly<ExportPresetPickerProps>) {
  const activePresetId = useMemo(() => {
    const matchingPreset = exportPresets.find(
      (preset) =>
        preset.mode === mode &&
        preset.includeAttachments === includeAttachments &&
        preset.includeMetadataAppendix === includeMetadataAppendix
    );

    return matchingPreset?.id ?? null;
  }, [includeAttachments, includeMetadataAppendix, mode]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-200">Presets</span>
        {activePresetId ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
            Preset active
          </span>
        ) : (
          <span className="text-xs text-zinc-500">Custom configuration</span>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {exportPresets.map((preset) => {
          const selected = activePresetId === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className={[
                "rounded-md border px-3 py-3 text-left transition",
                selected
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:bg-zinc-900",
              ].join(" ")}
            >
              <p className="text-sm font-semibold">{preset.label}</p>
              <p className="mt-1 text-xs text-zinc-400">{preset.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}