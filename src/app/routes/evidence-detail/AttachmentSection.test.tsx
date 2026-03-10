import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttachmentSection } from "./AttachmentSection";

const baseEvidence = {
  id: "item-1",
  caseId: "case-1",
  kind: "photo" as const,
  title: "Door photo",
  recordedAt: "2026-03-02T10:00:00.000Z",
  includeInExport: true,
  redactionStatus: "none" as const,
  dateCertainty: "exact" as const,
  createdAt: "2026-03-02T10:00:00.000Z",
  updatedAt: "2026-03-02T10:00:00.000Z",
};

describe("AttachmentSection", () => {
  it("renders an empty attachment state", () => {
    const html = renderToStaticMarkup(
      <AttachmentSection
        evidence={baseEvidence}
        attachment={undefined}
        blobUrl={null}
        redactions={[]}
        redactMode={false}
        savingRedactions={false}
        redactionFeedback={null}
        hasPendingRedactionChanges={false}
        onToggleRedactMode={() => {}}
        onChangeRedactions={() => {}}
        onSaveRedactions={() => {}}
      />
    );

    expect(html).toContain("No attachment blob linked to this evidence item.");
  });

  it("renders image redaction controls for image attachments", () => {
    const html = renderToStaticMarkup(
      <AttachmentSection
        evidence={{ ...baseEvidence, mimeType: "image/jpeg" }}
        attachment={{
          id: "att-1",
          evidenceItemId: "item-1",
          blob: new Blob(["image"]),
          sizeBytes: 2048,
          mimeType: "image/jpeg",
          originalFilename: "door.jpg",
          createdAt: "2026-03-02T10:00:00.000Z",
        }}
        blobUrl="blob:test"
        redactions={[]}
        redactMode={false}
        savingRedactions={false}
        redactionFeedback={null}
        hasPendingRedactionChanges={false}
        onToggleRedactMode={() => {}}
        onChangeRedactions={() => {}}
        onSaveRedactions={() => {}}
      />
    );

    expect(html).toContain("Toggle redact mode to add non-destructive redaction overlays.");
    expect(html).toContain("Enter Redact Mode");
    expect(html).toContain("Save Redactions");
  });
});