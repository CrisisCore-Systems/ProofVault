import { AddAttachmentButton } from "../ui/AddAttachmentButton";
import { NewIncidentButton } from "../ui/NewIncidentButton";

export function TopHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
      <div>
        <h1 className="text-sm font-semibold tracking-wide text-zinc-100">ProofVault</h1>
        <p className="text-xs text-zinc-400">Protective evidence field instrument</p>
      </div>
      <div className="flex items-center gap-2">
        <NewIncidentButton />
        <AddAttachmentButton />
        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
          v0.3 Phase 3
        </span>
      </div>
    </header>
  );
}
