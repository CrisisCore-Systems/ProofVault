import type { CaseFile, EvidenceItem } from "../../domain/types";
import type { CaseIntegrityReport } from "../evidence/integrity";

export type CaseActivityEvent = {
  id: string;
  timestamp: string;
  label: string;
  details?: string;
};

function pushEvidenceEvents(events: CaseActivityEvent[], caseItems: EvidenceItem[]) {
  for (const item of caseItems) {
    events.push({
      id: `evidence-added-${item.id}`,
      timestamp: item.createdAt,
      label: `Evidence added: ${item.title}`,
      details: item.kind,
    });

    if (item.sha256) {
      events.push({
        id: `hash-computed-${item.id}`,
        timestamp: item.createdAt,
        label: `Hash computed: ${item.title}`,
      });
    }
  }
}

function pushVerificationEvents(
  events: CaseActivityEvent[],
  caseFile: CaseFile,
  caseReport?: CaseIntegrityReport
) {
  if (caseFile.lastVerifiedAt) {
    events.push({
      id: `case-verified-${caseFile.id}`,
      timestamp: caseFile.lastVerifiedAt,
      label: "Case verification completed",
    });
  }

  if (caseReport) {
    events.push({
      id: `case-verify-run-${caseFile.id}-${caseReport.checkedAt}`,
      timestamp: caseReport.checkedAt,
      label: "Verification run completed",
      details: `${caseReport.verified} verified · ${caseReport.mismatch} mismatch · ${caseReport.unverifiable} unverifiable · ${caseReport.skipped} skipped`,
    });

    if (caseReport.mismatch > 0) {
      events.push({
        id: `case-mismatch-${caseFile.id}-${caseReport.checkedAt}`,
        timestamp: caseReport.checkedAt,
        label: "Verification mismatch detected",
        details: `${caseReport.mismatch} file(s) mismatched`,
      });
    }
  }
}

export function buildCaseActivityTimeline(
  caseFile: CaseFile,
  caseItems: EvidenceItem[],
  caseReport?: CaseIntegrityReport
): CaseActivityEvent[] {
  const events: CaseActivityEvent[] = [];

  pushEvidenceEvents(events, caseItems);
  pushVerificationEvents(events, caseFile, caseReport);

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
