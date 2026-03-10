import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExportPreflightActions } from "./ExportPreflightActions";

describe("ExportPreflightActions", () => {
  it("renders both preflight actions and status message", () => {
    const html = renderToStaticMarkup(
      <ExportPreflightActions
        previewActionMessage="Manifest preview downloaded."
        onCopySummary={async () => {}}
        onDownloadManifestPreview={() => {}}
      />
    );

    expect(html).toContain("Copy Summary");
    expect(html).toContain("Download Manifest Preview");
    expect(html).toContain("Manifest preview downloaded.");
  });

  it("omits the status message when none is provided", () => {
    const html = renderToStaticMarkup(
      <ExportPreflightActions
        previewActionMessage={null}
        onCopySummary={async () => {}}
        onDownloadManifestPreview={() => {}}
      />
    );

    expect(html).not.toContain("Manifest preview downloaded.");
  });
});