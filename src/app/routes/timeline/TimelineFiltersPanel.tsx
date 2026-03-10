import type { CaseFile } from "../../../domain/types";
import type { TimelineFilters } from "../../../features/cases/timeline";

type TimelineFiltersPanelProps = {
  cases: CaseFile[];
  filters: TimelineFilters;
  peopleOptions: string[];
  activeFilterCount: number;
  onSetFilter: <K extends keyof TimelineFilters>(key: K, value: TimelineFilters[K]) => void;
  onClearFilters: () => void;
};

export function TimelineFiltersPanel({
  cases,
  filters,
  peopleOptions,
  activeFilterCount,
  onSetFilter,
  onClearFilters,
}: Readonly<TimelineFiltersPanelProps>) {
  return (
    <section className="pv-card mb-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="pv-section-title">Filters</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Narrow the cross-case chronology by case, category, person, date range, or review state.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
              {activeFilterCount} active
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">Case</span>
          <select
            value={filters.caseId}
            onChange={(event) => onSetFilter("caseId", event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          >
            <option value="all">All cases</option>
            <option value="unassigned">Unassigned only</option>
            {cases.map((caseFile) => (
              <option key={caseFile.id} value={caseFile.id}>
                {caseFile.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">Category</span>
          <select
            value={filters.kind}
            onChange={(event) => onSetFilter("kind", event.target.value as TimelineFilters["kind"])}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          >
            <option value="all">All categories</option>
            <option value="incident">Incident</option>
            <option value="photo">Photo</option>
            <option value="screenshot">Screenshot</option>
            <option value="pdf">PDF</option>
            <option value="audio">Audio</option>
            <option value="note">Note</option>
          </select>
        </label>

        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">Person</span>
          <input
            list="timeline-people"
            value={filters.personQuery}
            onChange={(event) => onSetFilter("personQuery", event.target.value)}
            placeholder="Filter by person"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          />
          <datalist id="timeline-people">
            {peopleOptions.map((person) => (
              <option key={person} value={person} />
            ))}
          </datalist>
        </label>

        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">From</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => onSetFilter("startDate", event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          />
        </label>

        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">To</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => onSetFilter("endDate", event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Review</span>
        {[
          { value: "all", label: "All" },
          { value: "export-ready", label: "Export ready" },
          { value: "needs-review", label: "Needs review" },
        ].map((option) => {
          const selected = filters.review === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSetFilter("review", option.value as TimelineFilters["review"])}
              className={[
                "rounded-full border px-3 py-1 text-xs transition",
                selected
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}