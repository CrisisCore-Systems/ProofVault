import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExportPresetPicker } from "./ExportPresetPicker";

describe("ExportPresetPicker", () => {
  it("shows an active preset when settings match a preset", () => {
    const html = renderToStaticMarkup(
      <ExportPresetPicker
        mode="redacted"
        includeAttachments={true}
        includeMetadataAppendix={true}
        onApplyPreset={() => {}}
      />
    );

    expect(html).toContain("Preset active");
    expect(html).toContain("Court-ready redacted");
    expect(html).toContain("Summary review packet");
  });

  it("shows custom configuration for non-preset combinations", () => {
    const html = renderToStaticMarkup(
      <ExportPresetPicker
        mode="full"
        includeAttachments={false}
        includeMetadataAppendix={true}
        onApplyPreset={() => {}}
      />
    );

    expect(html).toContain("Custom configuration");
  });
});