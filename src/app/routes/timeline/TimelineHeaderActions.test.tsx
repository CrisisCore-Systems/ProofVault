import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { TimelineHeaderActions } from "./TimelineHeaderActions";

describe("TimelineHeaderActions", () => {
  it("renders route action links and seed button", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TimelineHeaderActions onSeeded={async () => {}} />
      </MemoryRouter>
    );

    expect(html).toContain("New Incident");
    expect(html).toContain("Add Attachment");
    expect(html).toContain("Seed Test Data");
  });
});