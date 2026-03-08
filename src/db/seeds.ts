import { addMinutes, subDays } from "date-fns";
import type { CaseFile, EvidenceItem, ExportBundle } from "../domain/types";
import { db } from "./index";
import { upsertCaseFile, upsertEvidenceItem, upsertExportBundle } from "./queries";

function buildNowIso(): string {
  return new Date().toISOString();
}

export async function seedDemoData(): Promise<void> {
  const existingCaseCount = await db.cases.count();
  if (existingCaseCount > 0) {
    return;
  }

  const now = new Date();
  const createdAt = buildNowIso();

  const caseA: CaseFile = {
    id: "case-housing-001",
    title: "RTB Lockout Dispute",
    type: "housing",
    description: "Landlord lockout and notice conflict.",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  };

  const caseB: CaseFile = {
    id: "case-work-001",
    title: "Workplace Safety Incident",
    type: "work",
    description: "Documentation of denied protective equipment.",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  };

  const evidenceSeed: EvidenceItem[] = [
    {
      id: "ev-001",
      caseId: caseA.id,
      kind: "incident",
      title: "Locked out at 08:20",
      description: "Building access denied. Witness present in lobby.",
      occurredAt: subDays(now, 4).toISOString(),
      recordedAt: subDays(now, 4).toISOString(),
      locationText: "Main entrance",
      peopleInvolved: ["Property manager", "Neighbor witness"],
      tags: ["lockout", "access"],
      includeInExport: true,
      redactionStatus: "none",
      dateCertainty: "exact",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ev-002",
      caseId: caseA.id,
      kind: "screenshot",
      title: "Text message threat screenshot",
      recordedAt: subDays(now, 3).toISOString(),
      importedAt: subDays(now, 3).toISOString(),
      originalFilename: "threat-message.png",
      mimeType: "image/png",
      sha256: "demo-sha256-002",
      includeInExport: true,
      redactionStatus: "partial",
      dateCertainty: "exact",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ev-003",
      caseId: caseB.id,
      kind: "incident",
      title: "PPE denied before shift",
      recordedAt: subDays(now, 2).toISOString(),
      occurredAt: subDays(now, 2).toISOString(),
      locationText: "Warehouse floor",
      peopleInvolved: ["Supervisor"],
      includeInExport: true,
      redactionStatus: "none",
      dateCertainty: "exact",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ev-004",
      caseId: caseB.id,
      kind: "audio",
      title: "Voice memo after meeting",
      recordedAt: addMinutes(subDays(now, 2), 30).toISOString(),
      importedAt: addMinutes(subDays(now, 2), 35).toISOString(),
      originalFilename: "memo-1.m4a",
      mimeType: "audio/mp4",
      sha256: "demo-sha256-004",
      includeInExport: true,
      redactionStatus: "none",
      dateCertainty: "approximate",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ev-005",
      kind: "note",
      title: "Unassigned intake note",
      description: "Need to confirm exact time from bus receipt.",
      recordedAt: subDays(now, 1).toISOString(),
      includeInExport: false,
      redactionStatus: "none",
      dateCertainty: "unknown",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ev-006",
      kind: "pdf",
      title: "Unsigned notice letter",
      recordedAt: subDays(now, 1).toISOString(),
      importedAt: subDays(now, 1).toISOString(),
      originalFilename: "notice.pdf",
      mimeType: "application/pdf",
      sha256: "demo-sha256-006",
      includeInExport: true,
      redactionStatus: "full",
      dateCertainty: "exact",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const exportBundle: ExportBundle = {
    id: "exp-001",
    caseId: caseA.id,
    mode: "redacted",
    createdAt,
    itemIds: ["ev-001", "ev-002"],
    manifestRef: "manifest-2026-03-07.json",
    archiveRef: "proofvault-rtb-redacted.zip",
  };

  await upsertCaseFile(caseA);
  await upsertCaseFile(caseB);
  await Promise.all(evidenceSeed.map((item) => upsertEvidenceItem(item)));
  await upsertExportBundle(exportBundle);
}
