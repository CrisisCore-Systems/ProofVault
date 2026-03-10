import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExportBanner } from "./ExportBanner";

describe("ExportBanner", () => {
  it("renders restored settings messaging", () => {
    const html = renderToStaticMarkup(<ExportBanner restoredFromStorage={true} onReset={() => {}} />);

    expect(html).toContain("Last-used export settings restored for this device.");
    expect(html).toContain("Reset to defaults");
  });

  it("renders default settings messaging", () => {
    const html = renderToStaticMarkup(<ExportBanner restoredFromStorage={false} onReset={() => {}} />);

    expect(html).toContain("Using default export settings.");
  });
});