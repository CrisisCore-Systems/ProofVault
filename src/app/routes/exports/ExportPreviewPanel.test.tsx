import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExportPreviewPanel } from "./ExportPreviewPanel";

describe("ExportPreviewPanel", () => {
  it("renders the empty preview state", () => {
    const html = renderToStaticMarkup(<ExportPreviewPanel previewItems={[]} />);

    expect(html).toContain("Choose a case to preview export contents.");
  });

  it("renders included and excluded preview sections", () => {
    const html = renderToStaticMarkup(
      <ExportPreviewPanel
        previewItems={[
          {
            id: "item-1",
            title: "Door photo",
            kind: "photo",
            timestamp: "2026-03-02T10:00:00.000Z",
            included: true,
            selectionReason: "Included by current filters.",
            attachmentDisposition: "included",
            attachmentReason: "Attachment will be included.",
          },
          {
            id: "item-2",
            title: "Private draft",
            kind: "note",
            timestamp: "2026-03-03T10:00:00.000Z",
            included: false,
            selectionReason: "Item is currently excluded from export.",
            attachmentDisposition: "not-applicable",
            attachmentReason: "No attachment.",
          },
        ]}
      />
    );

    expect(html).toContain("Included: 1");
    expect(html).toContain("Excluded: 1");
    expect(html).toContain("Door photo");
    expect(html).toContain("attachment included");
    expect(html).toContain("Private draft");
  });
});