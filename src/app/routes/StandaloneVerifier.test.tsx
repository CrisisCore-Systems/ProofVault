import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StandaloneVerifier } from "./StandaloneVerifier";

describe("StandaloneVerifier", () => {
  it("renders the external verification workflow", () => {
    const html = renderToStaticMarkup(<StandaloneVerifier />);

    expect(html).toContain("Standalone Verifier");
    expect(html).toContain("Proof manifest file");
    expect(html).toContain("Encrypted backup file");
    expect(html).toContain("Backup passphrase");
    expect(html).toContain("Vault passphrase");
    expect(html).toContain("Download Verification Report");
    expect(html).toContain("Verify External Proof");
    expect(html).toContain("No verification run yet");
  });
});