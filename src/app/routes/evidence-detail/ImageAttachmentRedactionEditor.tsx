import { type PointerEvent, useState } from "react";
import type { RedactionRegion } from "../../../domain/types";
import type { EvidenceDetailView } from "../../../features/evidence/evidenceDetailView";
import type { EvidenceItem } from "../../../domain/types";
import { buildRegionFromPoints, roundPercentage } from "./redactionGeometry";

type ImageAttachmentRedactionEditorProps = {
  evidence: EvidenceItem;
  attachment: NonNullable<EvidenceDetailView["attachment"]>;
  blobUrl: string;
  redactions: RedactionRegion[];
  redactMode: boolean;
  savingRedactions: boolean;
  redactionFeedback: string | null;
  hasPendingRedactionChanges: boolean;
  onToggleRedactMode: () => void;
  onChangeRedactions: (value: RedactionRegion[]) => void;
  onSaveRedactions: () => void;
};

export function ImageAttachmentRedactionEditor({
  evidence,
  attachment,
  blobUrl,
  redactions,
  redactMode,
  savingRedactions,
  redactionFeedback,
  hasPendingRedactionChanges,
  onToggleRedactMode,
  onChangeRedactions,
  onSaveRedactions,
}: Readonly<ImageAttachmentRedactionEditorProps>) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draftRegion, setDraftRegion] = useState<Omit<RedactionRegion, "id"> | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!redactMode || event.button !== 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const startX = roundPercentage(((event.clientX - bounds.left) / bounds.width) * 100);
    const startY = roundPercentage(((event.clientY - bounds.top) / bounds.height) * 100);

    setDragStart({ x: startX, y: startY });
    setDraftRegion({ x: startX, y: startY, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!redactMode || !dragStart) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const currentX = roundPercentage(((event.clientX - bounds.left) / bounds.width) * 100);
    const currentY = roundPercentage(((event.clientY - bounds.top) / bounds.height) * 100);
    setDraftRegion(buildRegionFromPoints(dragStart.x, dragStart.y, currentX, currentY));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!redactMode || !dragStart || !draftRegion) {
      return;
    }

    const minimumPercent = 0.5;
    if (draftRegion.width >= minimumPercent && draftRegion.height >= minimumPercent) {
      onChangeRedactions([
        ...redactions,
        {
          id: crypto.randomUUID(),
          ...draftRegion,
        },
      ]);
    }

    setDragStart(null);
    setDraftRegion(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="space-y-3">
      <div className="relative inline-block overflow-hidden rounded-md border border-zinc-800">
        <img src={blobUrl} alt={evidence.title} className="block max-h-[420px] max-w-full select-none object-contain" />

        <div
          className={[
            "absolute inset-0",
            redactMode ? "cursor-crosshair" : "pointer-events-none",
          ].join(" ")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {redactions.map((region) => (
            <div
              key={region.id}
              className="absolute border border-yellow-500/80 bg-black/95"
              style={{
                left: `${region.x}%`,
                top: `${region.y}%`,
                width: `${region.width}%`,
                height: `${region.height}%`,
              }}
            />
          ))}

          {draftRegion ? (
            <div
              className="absolute border border-yellow-300 bg-black/70"
              style={{
                left: `${draftRegion.x}%`,
                top: `${draftRegion.y}%`,
                width: `${draftRegion.width}%`,
                height: `${draftRegion.height}%`,
              }}
            />
          ) : null}
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {redactMode
          ? "Redact mode active: click and drag over sensitive areas to add black overlays."
          : "Toggle redact mode to add non-destructive redaction overlays."}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleRedactMode}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          {redactMode ? "Exit Redact Mode" : "Enter Redact Mode"}
        </button>

        <button
          type="button"
          disabled={redactions.length === 0}
          onClick={() => onChangeRedactions(redactions.slice(0, -1))}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Undo Last
        </button>

        <button
          type="button"
          disabled={redactions.length === 0}
          onClick={() => onChangeRedactions([])}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear All
        </button>

        <button
          type="button"
          disabled={savingRedactions || !hasPendingRedactionChanges}
          onClick={onSaveRedactions}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingRedactions ? "Saving..." : "Save Redactions"}
        </button>
      </div>

      <p className="text-xs text-zinc-500">Saved overlays: {redactions.length}</p>
      {redactionFeedback ? <p className="text-sm text-emerald-300">{redactionFeedback}</p> : null}

      <a
        href={blobUrl}
        download={attachment.originalFilename}
        className="inline-block rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Download original file
      </a>
    </div>
  );
}