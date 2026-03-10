import type { EvidenceItem } from "../../domain/types";

export type TimelineEvent = {
  id: string;
  type: "incident" | "evidence";
  title: string;
  timestamp: string;
  caseId: string;
  referenceId: string;
  kind: EvidenceItem["kind"];
};

export type TimelineReviewFilter = "all" | "export-ready" | "needs-review";

export type TimelineFilters = {
  caseId: string;
  kind: "all" | EvidenceItem["kind"];
  personQuery: string;
  startDate: string;
  endDate: string;
  review: TimelineReviewFilter;
};

export function resolveTimelineTimestamp(item: EvidenceItem): string {
  return item.occurredAt ?? item.recordedAt ?? item.importedAt ?? item.createdAt;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function matchesCaseFilter(item: EvidenceItem, caseId: TimelineFilters["caseId"]): boolean {
  if (caseId === "all") {
    return true;
  }

  if (caseId === "unassigned") {
    return !item.caseId;
  }

  return item.caseId === caseId;
}

function matchesKindFilter(item: EvidenceItem, kind: TimelineFilters["kind"]): boolean {
  return kind === "all" || item.kind === kind;
}

function matchesPersonFilter(item: EvidenceItem, personQuery: string): boolean {
  if (!personQuery) {
    return true;
  }

  return item.peopleInvolved?.some((person) => person.toLowerCase().includes(personQuery)) ?? false;
}

function matchesDateRange(
  item: EvidenceItem,
  startDateEpoch: number | undefined,
  endDateEpoch: number | undefined
): boolean {
  const timestamp = Date.parse(resolveTimelineTimestamp(item));

  if (startDateEpoch !== undefined && timestamp < startDateEpoch) {
    return false;
  }

  if (endDateEpoch !== undefined && timestamp > endDateEpoch) {
    return false;
  }

  return true;
}

function matchesReviewFilter(item: EvidenceItem, review: TimelineReviewFilter): boolean {
  if (review === "all") {
    return true;
  }

  if (review === "export-ready") {
    return isExportReady(item);
  }

  return needsReview(item);
}

function isExportReady(item: EvidenceItem): boolean {
  return item.includeInExport && item.redactionStatus !== "full";
}

function needsReview(item: EvidenceItem): boolean {
  return !item.includeInExport || item.redactionStatus !== "none" || item.dateCertainty === "unknown";
}

export function filterTimelineItems(items: EvidenceItem[], filters: TimelineFilters): EvidenceItem[] {
  const normalizedPersonQuery = normalizeText(filters.personQuery);
  const startDateEpoch = filters.startDate ? Date.parse(`${filters.startDate}T00:00:00`) : undefined;
  const endDateEpoch = filters.endDate ? Date.parse(`${filters.endDate}T23:59:59.999`) : undefined;

  return items.filter(
    (item) =>
      matchesCaseFilter(item, filters.caseId) &&
      matchesKindFilter(item, filters.kind) &&
      matchesPersonFilter(item, normalizedPersonQuery) &&
      matchesDateRange(item, startDateEpoch, endDateEpoch) &&
      matchesReviewFilter(item, filters.review)
  );
}

export function buildCaseTimeline(caseId: string, items: EvidenceItem[]): TimelineEvent[] {
  const events = items.map<TimelineEvent>((item) => ({
    id: item.id,
    type: item.kind === "incident" ? "incident" : "evidence",
    title: item.title,
    timestamp: resolveTimelineTimestamp(item),
    caseId,
    referenceId: item.id,
    kind: item.kind,
  }));

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
