import { useEffect, useMemo, useState } from "react";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import { listCases, listTimelineEvidenceItems } from "../../db/queries";
import { filterTimelineItems, type TimelineFilters } from "./timeline";

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  caseId: "all",
  kind: "all",
  personQuery: "",
  startDate: "",
  endDate: "",
  review: "all",
};

export function reviewBadge(item: EvidenceItem): { label: string; className: string } {
  if (!item.includeInExport || item.dateCertainty === "unknown") {
    return {
      label: "Needs review",
      className: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    };
  }

  if (item.redactionStatus !== "none") {
    return {
      label: item.redactionStatus === "full" ? "Redacted fully" : "Redacted partially",
      className: "border-blue-500/40 bg-blue-500/10 text-blue-200",
    };
  }

  return {
    label: "Export ready",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  };
}

export function getTimelinePeopleOptions(items: EvidenceItem[]): string[] {
  const names = new Set<string>();

  for (const item of items) {
    item.peopleInvolved?.forEach((person) => names.add(person));
  }

  return Array.from(names).sort((left, right) => left.localeCompare(right));
}

export function getActiveTimelineFilterCount(filters: TimelineFilters): number {
  let count = 0;

  if (filters.caseId !== DEFAULT_TIMELINE_FILTERS.caseId) {
    count += 1;
  }

  if (filters.kind !== DEFAULT_TIMELINE_FILTERS.kind) {
    count += 1;
  }

  if (filters.personQuery !== DEFAULT_TIMELINE_FILTERS.personQuery) {
    count += 1;
  }

  if (
    filters.startDate !== DEFAULT_TIMELINE_FILTERS.startDate ||
    filters.endDate !== DEFAULT_TIMELINE_FILTERS.endDate
  ) {
    count += 1;
  }

  if (filters.review !== DEFAULT_TIMELINE_FILTERS.review) {
    count += 1;
  }

  return count;
}

export function useTimelineOverview() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [filters, setFilters] = useState<TimelineFilters>(DEFAULT_TIMELINE_FILTERS);

  const load = async () => {
    const [timelineItems, caseItems] = await Promise.all([listTimelineEvidenceItems(), listCases()]);
    setItems(timelineItems);
    setCases(caseItems);
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleItems = useMemo(() => filterTimelineItems(items, filters), [items, filters]);
  const peopleOptions = useMemo(() => getTimelinePeopleOptions(items), [items]);
  const activeFilterCount = useMemo(() => getActiveTimelineFilterCount(filters), [filters]);

  const setFilter = <K extends keyof TimelineFilters>(key: K, value: TimelineFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => setFilters(DEFAULT_TIMELINE_FILTERS);

  return {
    items,
    cases,
    filters,
    visibleItems,
    peopleOptions,
    activeFilterCount,
    load,
    setFilter,
    clearFilters,
  };
}