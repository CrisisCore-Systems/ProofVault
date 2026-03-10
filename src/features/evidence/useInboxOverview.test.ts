import { describe, expect, it } from "vitest";
import { getInboxSavedFeedbackMessage, parseInboxSavedType } from "./useInboxOverview";

describe("useInboxOverview helpers", () => {
  it("parses supported saved feedback values", () => {
    expect(parseInboxSavedType("attachment")).toBe("attachment");
    expect(parseInboxSavedType("incident")).toBe("incident");
    expect(parseInboxSavedType("other")).toBeNull();
    expect(parseInboxSavedType(null)).toBeNull();
  });

  it("returns the correct saved feedback message", () => {
    expect(getInboxSavedFeedbackMessage("attachment")).toBe("Attachment saved locally.");
    expect(getInboxSavedFeedbackMessage("incident")).toBe("Incident saved locally.");
    expect(getInboxSavedFeedbackMessage(null)).toBeNull();
  });
});