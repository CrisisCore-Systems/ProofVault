import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttachmentMetadataSection } from "./AttachmentMetadataSection";

describe("AttachmentMetadataSection", () => {
  it("renders attachment metadata and integrity results", () => {
    const html = renderToStaticMarkup(
      <AttachmentMetadataSection
        evidence={{
          id: "item-1",
          caseId: "case-1",
          kind: "photo",
          title: "Door photo",
          recordedAt: "2026-03-02T10:00:00.000Z",
          includeInExport: true,
          redactionStatus: "none",
          dateCertainty: "exact",
          originalFilename: "door.jpg",
          mimeType: "image/jpeg",
          sha256: "1234567890123456789012345678901234567890",
          createdAt: "2026-03-02T10:00:00.000Z",
          updatedAt: "2026-03-02T10:00:00.000Z",
        }}
        attachment={{
          id: "att-1",
          evidenceItemId: "item-1",
          blob: new Blob(["image"]),
          sizeBytes: 2048,
          mimeType: "image/jpeg",
          originalFilename: "door.jpg",
          createdAt: "2026-03-02T10:00:00.000Z",
        }}
        verifyingIntegrity={false}
        integrityResult={{
          status: "verified",
          checkedAt: "2026-03-05T09:00:00.000Z",
          details: "Hash and file size match stored integrity metadata.",
          recomputedSha256: "abcdef1234567890",
        }}
        onVerifyIntegrity={() => {}}
        onCopyHash={() => {}}
        copyHashFeedback="Hash copied to clipboard."
      />
    );

    expect(html).toContain("Attachment Metadata");
    expect(html).toContain("door.jpg");
    expect(html).toContain("2.0 KB (2048 bytes)");
    expect(html).toContain("Integrity Status: ✔ Verified");
    expect(html).toContain("Hash copied to clipboard.");
  });
});