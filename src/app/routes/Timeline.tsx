import { useEffect, useState } from "react";
import type { EvidenceItem } from "../../domain/types";
import { listTimelineEvidenceItems } from "../../db/queries";
import { AddAttachmentButton } from "../../components/ui/AddAttachmentButton";
import { EmptyStateCard } from "../../components/ui/EmptyStateCard";
import { EvidenceItemSummary } from "../../components/ui/EvidenceItemSummary";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SeedDataButton } from "../../components/ui/SeedDataButton";
import { formatDisplayDateTime } from "../../lib/dates/format";
import { NewIncidentButton } from "../../components/ui/NewIncidentButton";

export function Timeline() {
  const [items, setItems] = useState<EvidenceItem[]>([]);

  const load = async () => {
    const data = await listTimelineEvidenceItems();
    setItems(data);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section>
      <SectionHeader
        title="Timeline"
        subtitle="Chronological evidence stream"
        rightSlot={
          <div className="flex items-center gap-2">
            <NewIncidentButton />
            <AddAttachmentButton />
            <SeedDataButton onSeeded={load} />
          </div>
        }
      />

      {items.length === 0 ? (
        <EmptyStateCard
          title="No timeline items"
          description="Seed data to validate chronology and item rendering."
          action={<AddAttachmentButton />}
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
