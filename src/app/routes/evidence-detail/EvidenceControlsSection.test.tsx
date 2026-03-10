import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidenceControlsSection } from "./EvidenceControlsSection";

describe("EvidenceControlsSection", () => {
  it("renders evidence control toggles, description, and saved state", () => {
    const html = renderToStaticMarkup(
      <EvidenceControlsSection
        includeInExport={true}
        redacted={true}
        description="Visible from hallway camera."
        savingControls={false}
        savedFeedback="Evidence controls saved."
        onChangeIncludeInExport={() => {}}
        onChangeRedacted={() => {}}
        onChangeDescription={() => {}}
        onSaveControls={() => {}}
      />
    );

    expect(html).toContain("Include in export");
    expect(html).toContain("Mark as redacted");
    expect(html).toContain("Visible from hallway camera.");
    expect(html).toContain("Evidence controls saved.");
    expect(html).toContain("Save Controls");
  });

  it("renders the saving state label", () => {
    const html = renderToStaticMarkup(
      <EvidenceControlsSection
        includeInExport={false}
        redacted={false}
        description=""
        savingControls={true}
        savedFeedback={null}
        onChangeIncludeInExport={() => {}}
        onChangeRedacted={() => {}}
        onChangeDescription={() => {}}
        onSaveControls={() => {}}
      />
    );

    expect(html).toContain("Saving...");
  });
});