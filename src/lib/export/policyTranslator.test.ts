import { describe, expect, it } from "vitest";
import { translateProofVaultRedactionPolicy } from "./policyTranslator";

describe("policyTranslator", () => {
  it("translates minimal policy omissions into plain language", () => {
    const translation = translateProofVaultRedactionPolicy({
      id: "minimal",
      label: "Minimal",
      mode: "redacted",
      omittedFields: ["description", "peopleInvolved", "locationText"],
      includeAttachments: false,
      includeMetadataAppendix: true,
    });

    expect(translation).toMatchObject({
      heading: "Minimal disclosure policy",
      omittedFieldLabels: ["Narrative notes", "Names of people involved", "Location details"],
    });
  });

  it("returns null when no policy metadata is available", () => {
    expect(translateProofVaultRedactionPolicy(null)).toBeNull();
  });
});