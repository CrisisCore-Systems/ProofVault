import { AddAttachmentButton } from "../../../components/ui/AddAttachmentButton";
import { SeedDataButton } from "../../../components/ui/SeedDataButton";
import { NewIncidentButton } from "../../../components/ui/NewIncidentButton";

type CasesHeaderActionsProps = {
  showStaleOnly: boolean;
  staleCaseCount: number;
  onToggleShowStaleOnly: () => void;
  onSeeded: () => Promise<void>;
};

export function CasesHeaderActions({
  showStaleOnly,
  staleCaseCount,
  onToggleShowStaleOnly,
  onSeeded,
}: Readonly<CasesHeaderActionsProps>) {
  return (
    <div className="flex items-center gap-2">
      <NewIncidentButton />
      <AddAttachmentButton />
      <button
        type="button"
        onClick={onToggleShowStaleOnly}
        className={[
          "rounded-md border px-3 py-2 text-xs",
          showStaleOnly
            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
            : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
        ].join(" ")}
      >
        {showStaleOnly ? "Showing Stale Only" : `Stale Only (${staleCaseCount})`}
      </button>
      <SeedDataButton onSeeded={onSeeded} />
    </div>
  );
}