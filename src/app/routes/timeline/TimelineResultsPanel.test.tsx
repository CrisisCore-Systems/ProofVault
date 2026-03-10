import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { EvidenceItem } from "../../../domain/types";
import { TimelineResultsPanel } from "./TimelineResultsPanel";

function createItem(overrides?: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: overrides?.id ?? "item-1",
    caseId: overrides?.caseId ?? "case-1",
    kind: overrides?.kind ?? "photo",
    title: overrides?.title ?? "Door photo",
    recordedAt: overrides?.recordedAt ?? "2026-03-02T10:00:00.000Z",
    occurredAt: overrides?.occurredAt,
    peopleInvolved: overrides?.peopleInvolved,
    includeInExport: overrides?.includeInExport ?? true,
    redactionStatus: overrides?.redactionStatus ?? "none",
    dateCertainty: overrides?.dateCertainty ?? "exact",
    createdAt: overrides?.createdAt ?? "2026-03-02T10:00:00.000Z",
    updatedAt: overrides?.updatedAt ?? "2026-03-02T10:00:00.000Z",
  };
}

describe("TimelineResultsPanel", () => {
  it("renders the empty timeline state", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TimelineResultsPanel items={[]} visibleItems={[]} onSelectPerson={() => {}} onClearFilters={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain("No timeline items");
  });

  it("renders visible results with people chips and counts", () => {
    const items = [createItem({ peopleInvolved: ["Alex"] }), createItem({ id: "item-2", title: "Note", kind: "note", includeInExport: false })];
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TimelineResultsPanel
          items={items}
          visibleItems={[items[0]!]} 
          onSelectPerson={() => {}}
          onClearFilters={() => {}}
        />
      </MemoryRouter>
    );

    expect(html).toContain("Showing 1 of 2 items");
    expect(html).toContain("Door photo");
    expect(html).toContain("Export ready");
    expect(html).toContain("Alex");
  });
});