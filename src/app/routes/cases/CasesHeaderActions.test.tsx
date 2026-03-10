import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CasesHeaderActions } from "./CasesHeaderActions";

function renderHeaderActions(showStaleOnly: boolean, staleCaseCount = 3) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <CasesHeaderActions
        showStaleOnly={showStaleOnly}
        staleCaseCount={staleCaseCount}
        onToggleShowStaleOnly={() => {}}
        onSeeded={async () => {}}
      />
    </MemoryRouter>
  );
}

describe("CasesHeaderActions", () => {
  it("renders the stale filter count when inactive", () => {
    const html = renderHeaderActions(false, 4);

    expect(html).toContain("Stale Only (4)");
    expect(html).toContain("Seed Test Data");
  });

  it("renders the active stale-only label", () => {
    const html = renderHeaderActions(true, 4);

    expect(html).toContain("Showing Stale Only");
  });
});