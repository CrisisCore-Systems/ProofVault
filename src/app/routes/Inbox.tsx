import { AddAttachmentButton } from "../../components/ui/AddAttachmentButton";
import { EmptyStateCard } from "../../components/ui/EmptyStateCard";
import { EvidenceItemSummary } from "../../components/ui/EvidenceItemSummary";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SeedDataButton } from "../../components/ui/SeedDataButton";
import { formatDisplayDateTime } from "../../lib/dates/format";
import { NewIncidentButton } from "../../components/ui/NewIncidentButton";
import { useInboxOverview } from "../../features/evidence/useInboxOverview";

export function Inbox() {
  const { items, load, savedFeedbackMessage, dismissSavedFeedback } = useInboxOverview();

  return (
    <section>
      <SectionHeader
        title="Inbox"
        subtitle="Recent captures and unresolved intake items"
        rightSlot={
          <div className="flex items-center gap-2">
            <NewIncidentButton />
            <AddAttachmentButton />
            <SeedDataButton onSeeded={load} />
          </div>
        }
      />

      {savedFeedbackMessage ? (
        <div className="mb-3 flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <span>{savedFeedbackMessage}</span>
          <button type="button" onClick={dismissSavedFeedback} className="text-xs text-emerald-300 hover:text-emerald-100">
            Dismiss
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyStateCard
          title="No items yet"
          description="Start by creating an incident or adding one attachment."
          action={
            <div className="flex items-center gap-2">
              <NewIncidentButton />
              <AddAttachmentButton />
            </div>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="pv-card">
              <div className="flex items-start justify-between gap-4">
                <EvidenceItemSummary item={item} />
                <span className="text-xs text-zinc-500">{formatDisplayDateTime(item.recordedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
