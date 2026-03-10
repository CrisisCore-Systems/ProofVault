import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "../../domain/types";
import {
  DEFAULT_TIMELINE_FILTERS,
  getActiveTimelineFilterCount,
  getTimelinePeopleOptions,
  reviewBadge,
} from "./useTimelineOverview";

function createItem(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: overrides.id ?? "item-1",
    caseId: overrides.caseId,
    kind: overrides.kind ?? "note",
    title: overrides.title ?? "Untitled",
    recordedAt: overrides.recordedAt ?? "2026-03-02T10:00:00.000Z",
    includeInExport: overrides.includeInExport ?? true,
    redactionStatus: overrides.redactionStatus ?? "none",
    dateCertainty: overrides.dateCertainty ?? "exact",
    peopleInvolved: overrides.peopleInvolved,
    createdAt: overrides.createdAt ?? "2026-03-02T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-02T10:00:00.000Z",
  };
}

describe("useTimelineOverview helpers", () => {
  it("returns sorted unique people options", () => {
    const result = getTimelinePeopleOptions([
      createItem({ peopleInvolved: ["Zara", "Alex"] }),
      createItem({ id: "item-2", peopleInvolved: ["Alex", "Mina"] }),
    ]);

    expect(result).toEqual(["Alex", "Mina", "Zara"]);
  });

  it("counts active filters by category", () => {
    expect(
      getActiveTimelineFilterCount({
        ...DEFAULT_TIMELINE_FILTERS,
        caseId: "case-1",
        personQuery: "alex",
        startDate: "2026-03-01",
        review: "needs-review",
      })
    ).toBe(4);
  });

  it("returns review badges for ready, redacted, and needs-review items", () => {
    expect(reviewBadge(createItem({})).label).toBe("Export ready");
    expect(reviewBadge(createItem({ redactionStatus: "partial" })).label).toBe("Redacted partially");
    expect(reviewBadge(createItem({ includeInExport: false })).label).toBe("Needs review");
  });
});