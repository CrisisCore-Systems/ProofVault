import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExportHistoryPanel } from "./ExportHistoryPanel";

describe("ExportHistoryPanel", () => {
  it("renders the empty export history state", () => {
    const html = renderToStaticMarkup(<ExportHistoryPanel bundles={[]} cases={[]} />);

    expect(html).toContain("No export bundles");
  });

  it("renders bundle history entries", () => {
    const html = renderToStaticMarkup(
      <ExportHistoryPanel
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
        bundles={[
          {
            id: "bundle-1",
            caseId: "case-1",
            mode: "redacted",
            itemIds: ["item-1", "item-2"],
            manifestRef: "manifest-1.json",
            archiveRef: "case-export.zip",
            createdAt: "2026-03-09T12:00:00.000Z",
          },
        ]}
      />
    );

    expect(html).toContain("Tenant Harassment Log");
    expect(html).toContain("redacted · 2 items");
    expect(html).toContain("Manifest: manifest-1.json");
    expect(html).toContain("Archive: case-export.zip");
  });
});