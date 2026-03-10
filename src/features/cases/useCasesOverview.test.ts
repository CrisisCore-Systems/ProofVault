import { describe, expect, it } from "vitest";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import {
  deriveCaseAttachmentState,
  summarizeCasesOverview,
  type CaseWithPreview,
} from "./useCasesOverview";

const baseCase: CaseFile = {
  id: "case-1",
  title: "Tenant Harassment Log",
  type: "housing",
  status: "active",
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

function createItem(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: overrides.id ?? "item-1",
    caseId: overrides.caseId ?? baseCase.id,
    kind: overrides.kind ?? "note",
    title: overrides.title ?? "Untitled item",
    recordedAt: overrides.recordedAt ?? "2026-03-02T10:00:00.000Z",
    includeInExport: overrides.includeInExport ?? true,
    redactionStatus: overrides.redactionStatus ?? "none",
    dateCertainty: overrides.dateCertainty ?? "exact",
    fileRef: overrides.fileRef,
    createdAt: overrides.createdAt ?? "2026-03-02T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-02T10:00:00.000Z",
  };
}

function createCaseOverview(overrides: Partial<CaseWithPreview>): CaseWithPreview {
  return {
    caseFile: overrides.caseFile ?? baseCase,
    caseItems: overrides.caseItems ?? [createItem({ fileRef: "att-1" })],
    timelineEvents: overrides.timelineEvents ?? [],
    hasAttachments: overrides.hasAttachments ?? true,
    isStaleVerification: overrides.isStaleVerification ?? false,
  };
}

describe("useCasesOverview helpers", () => {
  it("marks a case stale when attachments changed after the last verification", () => {
    const result = deriveCaseAttachmentState(
      {
        ...baseCase,
        lastVerifiedAt: "2026-03-01T09:00:00.000Z",
      },
      [Date.parse("2026-03-02T10:00:00.000Z")]
    );

    expect(result).toEqual({
      hasAttachments: true,
      isStaleVerification: true,
    });
  });

  it("treats a verified case as current when attachments predate verification", () => {
    const result = deriveCaseAttachmentState(
      {
        ...baseCase,
        lastVerifiedAt: "2026-03-05T09:00:00.000Z",
      },
      [Date.parse("2026-03-02T10:00:00.000Z")]
    );

    expect(result).toEqual({
      hasAttachments: true,
      isStaleVerification: false,
    });
  });

  it("summarizes counts and filters visible cases", () => {
    const cases = [
      createCaseOverview({
        caseFile: { ...baseCase, id: "case-1" },
        caseItems: [createItem({ id: "item-1", fileRef: "att-1" })],
        hasAttachments: true,
        isStaleVerification: false,
      }),
      createCaseOverview({
        caseFile: { ...baseCase, id: "case-2", title: "Noise complaint" },
        caseItems: [createItem({ id: "item-2", caseId: "case-2", fileRef: "att-2" })],
        hasAttachments: true,
        isStaleVerification: true,
      }),
      createCaseOverview({
        caseFile: { ...baseCase, id: "case-3", title: "Witness notes" },
        caseItems: [createItem({ id: "item-3", caseId: "case-3" })],
        hasAttachments: false,
        isStaleVerification: false,
      }),
    ];

    const summary = summarizeCasesOverview(
      cases,
      {
        "case-1": { loading: false, report: { mismatch: 1 } as never },
        "case-2": { loading: false, report: { mismatch: 2 } as never },
      },
      true
    );

    expect(summary.staleCaseCount).toBe(1);
    expect(summary.totalEvidenceFiles).toBe(2);
    expect(summary.verificationCurrentCases).toBe(1);
    expect(summary.mismatchCount).toBe(3);
    expect(summary.visibleCases).toHaveLength(1);
    expect(summary.visibleCases[0]?.caseFile.id).toBe("case-2");
  });
});