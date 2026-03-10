import { SectionHeader } from "../../components/ui/SectionHeader";
import { useTimelineOverview } from "../../features/cases/useTimelineOverview";
import { TimelineFiltersPanel } from "./timeline/TimelineFiltersPanel";
import { TimelineHeaderActions } from "./timeline/TimelineHeaderActions";
import { TimelineResultsPanel } from "./timeline/TimelineResultsPanel";

export function Timeline() {
  const { items, cases, filters, visibleItems, peopleOptions, activeFilterCount, load, setFilter, clearFilters } =
    useTimelineOverview();

  return (
    <section>
      <SectionHeader
        title="Timeline"
        subtitle="Chronological evidence stream"
        rightSlot={<TimelineHeaderActions onSeeded={load} />}
      />

      <TimelineFiltersPanel
        cases={cases}
        filters={filters}
        peopleOptions={peopleOptions}
        activeFilterCount={activeFilterCount}
        onSetFilter={setFilter}
        onClearFilters={clearFilters}
      />

      <TimelineResultsPanel
        items={items}
        visibleItems={visibleItems}
        onSelectPerson={(person) => setFilter("personQuery", person)}
        onClearFilters={clearFilters}
      />
    </section>
  );
}
