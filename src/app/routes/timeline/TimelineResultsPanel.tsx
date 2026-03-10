import { reviewBadge } from "../../../features/cases/useTimelineOverview";
import { AddAttachmentButton } from "../../../components/ui/AddAttachmentButton";
import { EmptyStateCard } from "../../../components/ui/EmptyStateCard";
import { EvidenceItemSummary } from "../../../components/ui/EvidenceItemSummary";
import type { EvidenceItem } from "../../../domain/types";
import { formatDisplayDateTime } from "../../../lib/dates/format";

type TimelineResultsPanelProps = {
  items: EvidenceItem[];
  visibleItems: EvidenceItem[];
  onSelectPerson: (person: string) => void;
  onClearFilters: () => void;
};

export function TimelineResultsPanel({
  items,
  visibleItems,
  onSelectPerson,
  onClearFilters,
}: Readonly<TimelineResultsPanelProps>) {
  if (items.length === 0) {
    return (
      <EmptyStateCard
        title="No timeline items"
        description="Seed data to validate chronology and item rendering."
        action={<AddAttachmentButton />}
      />
    );
  }

  if (visibleItems.length === 0) {
    return (
      <EmptyStateCard
        title="No matching timeline items"
        description="Try clearing one or more filters to widen the chronology view."
        action={
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Clear filters
          </button>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>
          Showing {visibleItems.length} of {items.length} items
        </span>
      </div>

      <ul className="space-y-2">
        {visibleItems.map((item) => {
          const badge = reviewBadge(item);

          return (
            <li key={item.id} className="pv-card">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <EvidenceItemSummary item={item} />

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300">
                      {item.kind}
                    </span>
                    <span className={["rounded-full border px-2 py-1", badge.className].join(" ")}>{badge.label}</span>
                    {item.peopleInvolved?.map((person) => (
                      <button
                        key={person}
                        type="button"
                        onClick={() => onSelectPerson(person)}
                        className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300 hover:bg-zinc-900"
                      >
                        {person}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 text-right text-xs text-zinc-500">
                  <p>{formatDisplayDateTime(item.recordedAt)}</p>
                  {item.occurredAt ? <p className="mt-1">Occurred {formatDisplayDateTime(item.occurredAt)}</p> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}