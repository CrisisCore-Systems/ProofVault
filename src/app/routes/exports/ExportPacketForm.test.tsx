import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExportPacketForm } from "./ExportPacketForm";

describe("ExportPacketForm", () => {
  it("renders case options, preview counts, and success state", () => {
    const html = renderToStaticMarkup(
      <ExportPacketForm
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
        selectedCaseId="case-1"
        mode="redacted"
        startDate="2026-03-01"
        endDate="2026-03-09"
        includeAttachments={true}
        includeMetadataAppendix={false}
        exportableItemsCount={5}
        attachmentCandidates={2}
        exporting={false}
        exportError={null}
        exportSuccess="Export generated."
        onSubmit={() => {}}
        onSelectCase={() => {}}
        onChangeStartDate={() => {}}
        onChangeEndDate={() => {}}
        onSelectMode={() => {}}
        onToggleAttachments={() => {}}
        onToggleMetadataAppendix={() => {}}
      />
    );

    expect(html).toContain("Tenant Harassment Log");
    expect(html).toContain("Preview: 5 export-ready items, 2 attachment candidates.");
    expect(html).toContain("Export generated.");
    expect(html).toContain("Generate ZIP Export");
  });

  it("renders loading and error states", () => {
    const html = renderToStaticMarkup(
      <ExportPacketForm
        cases={[]}
        selectedCaseId=""
        mode="full"
        startDate=""
        endDate=""
        includeAttachments={false}
        includeMetadataAppendix={true}
        exportableItemsCount={0}
        attachmentCandidates={0}
        exporting={true}
        exportError="Unable to generate export."
        exportSuccess={null}
        onSubmit={() => {}}
        onSelectCase={() => {}}
        onChangeStartDate={() => {}}
        onChangeEndDate={() => {}}
        onSelectMode={() => {}}
        onToggleAttachments={() => {}}
        onToggleMetadataAppendix={() => {}}
      />
    );

    expect(html).toContain("Unable to generate export.");
    expect(html).toContain("Generating...");
  });
});