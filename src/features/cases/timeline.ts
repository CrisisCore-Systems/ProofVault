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

function resolveTimelineTimestamp(item: EvidenceItem): string {
  return item.occurredAt ?? item.recordedAt ?? item.importedAt ?? item.createdAt;
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
