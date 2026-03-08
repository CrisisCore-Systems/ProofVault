import { useEffect, useState } from "react";
import type { ExportBundle } from "../../domain/types";
import { listExportBundles } from "../../db/queries";
import { EmptyStateCard } from "../../components/ui/EmptyStateCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SeedDataButton } from "../../components/ui/SeedDataButton";
import { formatDisplayDateTime } from "../../lib/dates/format";

export function Exports() {
  const [bundles, setBundles] = useState<ExportBundle[]>([]);

  const load = async () => {
    const data = await listExportBundles();
    setBundles(data);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section>
      <SectionHeader
        title="Exports"
        subtitle="Generated export bundles and manifests"
        rightSlot={<SeedDataButton onSeeded={load} />}
      />

      {bundles.length === 0 ? (
        <EmptyStateCard
          title="No export bundles"
          description="Export generation is Phase 6; seed data provides one mock bundle now."
        />
      ) : (
        <ul className="space-y-2">
          {bundles.map((bundle) => (
            <li key={bundle.id} className="pv-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{bundle.id}</h3>
                  <p className="text-xs text-zinc-400">
                    {bundle.mode} · case {bundle.caseId} · {bundle.itemIds.length} items
                  </p>
                </div>
                <span className="text-xs text-zinc-500">{formatDisplayDateTime(bundle.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
