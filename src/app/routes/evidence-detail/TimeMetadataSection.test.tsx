import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeMetadataSection } from "./TimeMetadataSection";

describe("TimeMetadataSection", () => {
  it("renders time metadata fields", () => {
    const html = renderToStaticMarkup(
      <TimeMetadataSection
        evidence={{
          id: "item-1",
          caseId: "case-1",
          kind: "photo",
          title: "Door photo",
          occurredAt: "2026-03-01T09:00:00.000Z",
          recordedAt: "2026-03-02T10:00:00.000Z",
          importedAt: "2026-03-03T11:00:00.000Z",
          includeInExport: true,
          redactionStatus: "none",
          dateCertainty: "exact",
          createdAt: "2026-03-02T10:00:00.000Z",
          updatedAt: "2026-03-04T12:00:00.000Z",
        }}
      />
    );

    expect(html).toContain("Time Metadata");
    expect(html).toContain("Occurred");
    expect(html).toContain("Recorded");
    expect(html).toContain("Imported");
    expect(html).toContain("Created");
    expect(html).toContain("Updated");
  });
});