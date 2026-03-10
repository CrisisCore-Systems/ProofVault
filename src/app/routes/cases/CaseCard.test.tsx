import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import type { CaseFile, EvidenceItem } from "../../../domain/types";
import type { TimelineEvent } from "../../../features/cases/timeline";
import { CaseCard, type CaseCardProps } from "./CaseCard";

const baseCase: CaseFile = {
  id: "case-1",
  title: "Tenant Harassment Log",
  type: "housing",
  status: "active",
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

const baseItem: EvidenceItem = {
  id: "item-1",
  caseId: "case-1",
  kind: "photo",
  title: "Door photo",
  recordedAt: "2026-03-02T10:00:00.000Z",
  createdAt: "2026-03-02T10:00:00.000Z",
  updatedAt: "2026-03-02T10:00:00.000Z",
  includeInExport: true,
  redactionStatus: "none",
  dateCertainty: "exact",
  fileRef: "attachment-1",
  sha256: "abc123",
};

const baseTimelineEvent: TimelineEvent = {
  id: "timeline-1",
  type: "evidence",
  title: "Door photo",
  timestamp: "2026-03-02T10:00:00.000Z",
  caseId: "case-1",
  referenceId: "item-1",
  kind: "photo",
};

function renderCaseCard(props?: Partial<CaseCardProps>) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <CaseCard
        caseFile={props?.caseFile ?? baseCase}
        caseItems={props?.caseItems ?? [baseItem]}
        timelineEvents={props?.timelineEvents ?? [baseTimelineEvent]}
        hasAttachments={props?.hasAttachments ?? true}
        isStaleVerification={props?.isStaleVerification ?? false}
        caseVerification={props?.caseVerification}
        caseExport={props?.caseExport}
        previewMessage={props?.previewMessage}
        dropTargetCaseId={props?.dropTargetCaseId ?? null}
        onSetDropTargetCaseId={props?.onSetDropTargetCaseId ?? vi.fn()}
        onExportCaseReport={props?.onExportCaseReport ?? vi.fn(async () => {})}
        onCopyExportSummary={props?.onCopyExportSummary ?? vi.fn(async () => {})}
        onDownloadManifestPreview={props?.onDownloadManifestPreview ?? vi.fn()}
        onVerifyCaseEvidence={props?.onVerifyCaseEvidence ?? vi.fn(async () => {})}
        onHandleCaseDrop={props?.onHandleCaseDrop ?? vi.fn(async () => {})}
      />
    </MemoryRouter>
  );
}

describe("CaseCard", () => {
  it("renders stale/export preview state and empty timeline messaging", () => {
    const html = renderCaseCard({
      caseFile: {
        ...baseCase,
        lastVerifiedAt: "2026-03-01T09:00:00.000Z",
      },
      timelineEvents: [],
      isStaleVerification: true,
      previewMessage: "Manifest preview downloaded.",
      caseExport: {
        loading: false,
        success: "Export ready: 1 items and 1 attachments downloaded.",
        archiveRef: "proofvault-case.zip",
        exportedAt: "2026-03-05T09:00:00.000Z",
      },
    });

    expect(html).toContain("⚠ Needs Verification");
    expect(html).toContain("Manifest preview downloaded.");
    expect(html).toContain("Export ready: 1 items and 1 attachments downloaded.");
    expect(html).toContain("Archive: proofvault-case.zip");
    expect(html).toContain("No linked items yet.");
  });

  it("renders integrity report, activity, link, and verified attachment state", () => {
    const html = renderCaseCard({
      caseFile: {
        ...baseCase,
        lastVerifiedAt: "2026-03-05T09:00:00.000Z",
      },
      caseVerification: {
        loading: false,
        report: {
          checkedAt: "2026-03-05T09:00:00.000Z",
          total: 1,
          changed: 1,
          skipped: 0,
          verified: 1,
          mismatch: 0,
          unverifiable: 0,
          canUpdateLastVerifiedAt: true,
          items: [
            {
              evidenceId: "item-1",
              title: "Door photo",
              kind: "photo",
              status: "verified",
              details: "Hash and file size match stored integrity metadata.",
            },
          ],
        },
      },
    });

    expect(html).toContain("✓ Verified");
    expect(html).toContain("Evidence Integrity Report");
    expect(html).toContain("Verification run completed");
    expect(html).toContain("✓ Hash Verified");
    expect(html).toContain('href="/evidence/item-1"');
  });
});