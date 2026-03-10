import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { RelationshipsSection } from "./RelationshipsSection";

describe("RelationshipsSection", () => {
  it("renders linked case, incident, and attachment information", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RelationshipsSection
          caseFile={{
            id: "case-1",
            title: "Tenant Harassment Log",
            type: "housing",
            status: "active",
            createdAt: "2026-03-01T09:00:00.000Z",
            updatedAt: "2026-03-01T09:00:00.000Z",
          }}
          linkedIncident={{
            id: "incident-1",
            caseId: "case-1",
            kind: "incident",
            title: "Door pounding incident",
            recordedAt: "2026-03-02T10:00:00.000Z",
            includeInExport: true,
            redactionStatus: "none",
            dateCertainty: "exact",
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
        />
      </MemoryRouter>
    );

    expect(html).toContain("Tenant Harassment Log");
    expect(html).toContain("Door pounding incident");
    expect(html).toContain("Attachment ID: att-1");
    expect(html).toContain('href="/cases"');
    expect(html).toContain('href="/evidence/incident-1"');
  });
});