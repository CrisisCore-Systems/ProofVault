import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TimelineFiltersPanel } from "./TimelineFiltersPanel";

describe("TimelineFiltersPanel", () => {
  it("renders active filter status and filter options", () => {
    const html = renderToStaticMarkup(
      <TimelineFiltersPanel
        cases={[
          {
            id: "case-1",
            title: "Tenant Harassment Log",
            type: "housing",
            status: "active",
            createdAt: "2026-03-01T09:00:00.000Z",
            updatedAt: "2026-03-01T09:00:00.000Z",
          },
        ]}
        filters={{
          caseId: "case-1",
          kind: "photo",
          personQuery: "Alex",
          startDate: "2026-03-01",
          endDate: "2026-03-09",
          review: "needs-review",
        }}
        peopleOptions={["Alex", "Jordan"]}
        activeFilterCount={4}
        onSetFilter={() => {}}
        onClearFilters={() => {}}
      />
    );

    expect(html).toContain("Filters");
    expect(html).toContain("4 active");
    expect(html).toContain("Tenant Harassment Log");
    expect(html).toContain("All categories");
    expect(html).toContain("Export ready");
    expect(html).toContain("Needs review");
  });
});