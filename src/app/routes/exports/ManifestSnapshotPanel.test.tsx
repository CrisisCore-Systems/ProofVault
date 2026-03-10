import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ManifestSnapshotPanel } from "./ManifestSnapshotPanel";

describe("ManifestSnapshotPanel", () => {
  it("renders the empty state without a manifest", () => {
    const html = renderToStaticMarkup(<ManifestSnapshotPanel manifest={null} />);

    expect(html).toContain("Choose a case to inspect the manifest preview scope.");
  });

  it("renders manifest counts and settings", () => {
    const html = renderToStaticMarkup(
      <ManifestSnapshotPanel
        manifest={{
          schemaVersion: 1,
          preview: true,
          generatedAt: "2026-03-09T12:00:00.000Z",
          case: {
            id: "case-1",
            title: "Tenant Harassment Log",
            type: "housing",
            status: "active",
          },
          options: {
            mode: "redacted",
            includeAttachments: true,
            includeMetadataAppendix: false,
            startDate: "2026-03-01",
            endDate: "2026-03-09",
          },
          counts: {
            totalItems: 4,
            includedItems: 3,
            excludedItems: 1,
            attachmentsIncluded: 2,
            attachmentsOmitted: 1,
            itemsWithoutAttachments: 1,
          },
          items: [],
        }}
      />
    );

    expect(html).toContain("Manifest snapshot");
    expect(html).toContain(">3<");
    expect(html).toContain("1 excluded");
    expect(html).toContain("Attachments on");
    expect(html).toContain("Tenant Harassment Log");
  });
});