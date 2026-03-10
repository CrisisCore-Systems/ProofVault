type ExportBannerProps = {
  restoredFromStorage: boolean;
  onReset: () => void;
};

export function ExportBanner({ restoredFromStorage, onReset }: Readonly<ExportBannerProps>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-xs">
      <div className="text-zinc-400">
        {restoredFromStorage ? "Last-used export settings restored for this device." : "Using default export settings."}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200 hover:bg-zinc-800"
      >
        Reset to defaults
      </button>
    </div>
  );
}