import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CasesOverviewStats } from "./CasesOverviewStats";

describe("CasesOverviewStats", () => {
  it("renders counts and a healthy ledger summary", () => {
    const html = renderToStaticMarkup(
      <CasesOverviewStats
        caseCount={7}
        totalEvidenceFiles={12}
        verificationCurrentCases={5}
        staleCaseCount={2}
        mismatchCount={1}
        ledgerHealth={{
          chainValid: true,
          entries: 42,
          lastEventAt: "2026-03-09T12:00:00.000Z",
          vaultRootHash: "abc123root",
        }}
      />
    );

    expect(html).toContain("Cases");
    expect(html).toContain(">7<");
    expect(html).toContain("Evidence Files");
    expect(html).toContain(">12<");
    expect(html).toContain("✓ Chain Valid");
    expect(html).toContain("Entries: 42");
    expect(html).toContain("Root: abc123root");
  });

  it("renders an unhealthy ledger state", () => {
    const html = renderToStaticMarkup(
      <CasesOverviewStats
        caseCount={1}
        totalEvidenceFiles={0}
        verificationCurrentCases={0}
        staleCaseCount={0}
        mismatchCount={0}
        ledgerHealth={{
          chainValid: false,
          entries: 3,
          lastEventAt: undefined,
          vaultRootHash: undefined,
        }}
      />
    );

    expect(html).toContain("⚠ Integrity Error");
  });
});