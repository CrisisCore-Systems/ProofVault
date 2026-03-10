import { describe, expect, it } from "vitest";
import { deriveAttachmentTitleFromFile } from "./useNewAttachment";

describe("useNewAttachment helpers", () => {
  it("derives a title from a file name without extension", () => {
    const file = new File(["image"], "door-photo.jpg", { type: "image/jpeg" });

    expect(deriveAttachmentTitleFromFile(file)).toBe("door-photo");
  });

  it("keeps the original name when no extension is present", () => {
    const file = new File(["note"], "README", { type: "text/plain" });

    expect(deriveAttachmentTitleFromFile(file)).toBe("README");
  });
});