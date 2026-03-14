import { useEffect, useMemo, useState, type DragEvent } from "react";
import { format } from "date-fns";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import {
  getAttachmentByEvidenceItemId,
  getHydratedAttachmentByEvidenceItemId,
  listCases,
  listEvidenceItemsForCase,
  updateCaseLastVerifiedAt,
} from "../../db/queries";
import { DEFAULT_REDACTED_EXPORT_SETTINGS } from "../exports/config";
import { copyExportPreviewSummary, downloadExportPreviewManifest } from "../exports/preflight";
import { generateExportPacket } from "../../lib/export/exportBundle";
import { buildCaseTimeline, type TimelineEvent } from "./timeline";
import { verifyCaseEvidenceIntegrity } from "../evidence/integrity";
import { saveAttachment } from "../evidence/attachmentActions";
import { appendLedgerEvent, getLedgerHealth, type LedgerHealth } from "../ledger/chain";
import type { CaseExportState, CaseVerificationState } from "../../app/routes/cases/CaseCard";
import { getSessionKey } from "../security/session";

export type CaseWithPreview = {
  caseFile: CaseFile;
  caseItems: EvidenceItem[];
  timelineEvents: TimelineEvent[];
  hasAttachments: boolean;
  isStaleVerification: boolean;
};

function parseIsoToEpoch(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

function localDateTimeNowValue(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

export function deriveCaseAttachmentState(
  caseFile: CaseFile,
  attachmentChangeEpochs: Array<number | undefined>
): Pick<CaseWithPreview, "hasAttachments" | "isStaleVerification"> {
  const newestAttachmentChangeEpoch = attachmentChangeEpochs.reduce<number | undefined>((latest, current) => {
    if (current === undefined) {
      return latest;
    }

    if (latest === undefined) {
      return current;
    }

    return Math.max(latest, current);
  }, undefined);

  const hasAttachments = newestAttachmentChangeEpoch !== undefined;
  const lastVerifiedEpoch = parseIsoToEpoch(caseFile.lastVerifiedAt);
  const isStaleVerification =
    hasAttachments &&
    (lastVerifiedEpoch === undefined ||
      (newestAttachmentChangeEpoch !== undefined && newestAttachmentChangeEpoch > lastVerifiedEpoch));

  return {
    hasAttachments,
    isStaleVerification,
  };
}

export function summarizeCasesOverview(
  cases: CaseWithPreview[],
  verificationByCaseId: Record<string, CaseVerificationState>,
  showStaleOnly: boolean
) {
  const staleCaseCount = cases.filter((caseData) => caseData.isStaleVerification).length;
  const totalEvidenceFiles = cases.reduce(
    (sum, caseData) => sum + caseData.caseItems.filter((item) => Boolean(item.fileRef)).length,
    0
  );
  const verificationCurrentCases = cases.filter(
    (caseData) => caseData.hasAttachments && !caseData.isStaleVerification
  ).length;
  const mismatchCount = Object.values(verificationByCaseId).reduce(
    (sum, verification) => sum + (verification.report?.mismatch ?? 0),
    0
  );
  const visibleCases = showStaleOnly ? cases.filter((caseData) => caseData.isStaleVerification) : cases;

  return {
    staleCaseCount,
    totalEvidenceFiles,
    verificationCurrentCases,
    mismatchCount,
    visibleCases,
  };
}

export function useCasesOverview() {
  const [cases, setCases] = useState<CaseWithPreview[]>([]);
  const [verificationByCaseId, setVerificationByCaseId] = useState<Record<string, CaseVerificationState>>({});
  const [exportByCaseId, setExportByCaseId] = useState<Record<string, CaseExportState>>({});
  const [previewMessageByCaseId, setPreviewMessageByCaseId] = useState<Record<string, string | undefined>>({});
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [dropTargetCaseId, setDropTargetCaseId] = useState<string | null>(null);
  const [ledgerHealth, setLedgerHealth] = useState<LedgerHealth | null>(null);

  const { staleCaseCount, totalEvidenceFiles, verificationCurrentCases, mismatchCount, visibleCases } = useMemo(
    () => summarizeCasesOverview(cases, verificationByCaseId, showStaleOnly),
    [cases, verificationByCaseId, showStaleOnly]
  );

  const load = async () => {
    const data = await listCases();
    const hydrated = await Promise.all(
      data.map(async (caseFile) => {
        const items = await listEvidenceItemsForCase(caseFile.id);
        const attachmentChangeEpochs = await Promise.all(
          items
            .filter((item) => Boolean(item.fileRef))
            .map(async (item) => {
              const attachment = await getAttachmentByEvidenceItemId(item.id);
              return parseIsoToEpoch(attachment?.updatedAt ?? attachment?.createdAt);
            })
        );
        const { hasAttachments, isStaleVerification } = deriveCaseAttachmentState(caseFile, attachmentChangeEpochs);

        return {
          caseFile,
          caseItems: items,
          timelineEvents: buildCaseTimeline(caseFile.id, items),
          hasAttachments,
          isStaleVerification,
        };
      })
    );
    setCases(hydrated);

    const health = await getLedgerHealth();
    setLedgerHealth(health);
  };

  const exportCaseReport = async (
    caseFile: CaseFile,
    caseItems: EvidenceItem[],
    _timelineEvents: TimelineEvent[]
  ) => {
    setPreviewMessageByCaseId((previous) => ({
      ...previous,
      [caseFile.id]: undefined,
    }));

    setExportByCaseId((previous) => ({
      ...previous,
      [caseFile.id]: {
        loading: true,
      },
    }));

    try {
      const result = await generateExportPacket({
        caseFile,
        items: caseItems,
        ...DEFAULT_REDACTED_EXPORT_SETTINGS,
      });

      await load();

      setExportByCaseId((previous) => ({
        ...previous,
        [caseFile.id]: {
          loading: false,
          success: `Export ready: ${result.exportedItemCount} items and ${result.exportedAttachmentCount} attachments downloaded.`,
          archiveRef: result.downloadedFileName,
          exportedAt: result.bundle.createdAt,
        },
      }));
    } catch (error) {
      setExportByCaseId((previous) => ({
        ...previous,
        [caseFile.id]: {
          loading: false,
          error: error instanceof Error ? error.message : "Failed to export case report",
        },
      }));
    }
  };

  const handleCopyExportSummary = async (caseFile: CaseFile, caseItems: EvidenceItem[]) => {
    const result = await copyExportPreviewSummary({
      caseFile,
      items: caseItems,
      ...DEFAULT_REDACTED_EXPORT_SETTINGS,
    });

    setPreviewMessageByCaseId((previous) => ({
      ...previous,
      [caseFile.id]: result.message,
    }));
  };

  const handleDownloadManifestPreview = (caseFile: CaseFile, caseItems: EvidenceItem[]) => {
    const result = downloadExportPreviewManifest({
      caseFile,
      items: caseItems,
      ...DEFAULT_REDACTED_EXPORT_SETTINGS,
    });

    setPreviewMessageByCaseId((previous) => ({
      ...previous,
      [caseFile.id]: result.message,
    }));
  };

  const verifyCaseEvidence = async (caseFile: CaseFile, caseItems: EvidenceItem[]) => {
    setVerificationByCaseId((previous) => ({
      ...previous,
      [caseFile.id]: {
        loading: true,
      },
    }));

    try {
      const report = await verifyCaseEvidenceIntegrity(caseItems, (evidenceItem) =>
        getHydratedAttachmentByEvidenceItemId(evidenceItem.id),
        caseFile.lastVerifiedAt
      );

      if (report.canUpdateLastVerifiedAt) {
        await updateCaseLastVerifiedAt(caseFile.id, report.checkedAt);
      }

      await appendLedgerEvent({
        event: "CASE_VERIFIED",
        caseId: caseFile.id,
        data: {
          checkedAt: report.checkedAt,
          total: report.total,
          verified: report.verified,
          mismatch: report.mismatch,
          unverifiable: report.unverifiable,
          skipped: report.skipped,
        },
      });

      if (report.mismatch > 0) {
        await appendLedgerEvent({
          event: "HASH_MISMATCH_DETECTED",
          caseId: caseFile.id,
          data: {
            checkedAt: report.checkedAt,
            mismatch: report.mismatch,
          },
        });
      }

      setVerificationByCaseId((previous) => ({
        ...previous,
        [caseFile.id]: {
          loading: false,
          report,
        },
      }));

      await load();
    } catch (error) {
      setVerificationByCaseId((previous) => ({
        ...previous,
        [caseFile.id]: {
          loading: false,
          error: error instanceof Error ? error.message : "Case verification failed",
        },
      }));
    }
  };

  const addAttachmentToCase = async (caseFile: CaseFile, file: File) => {
    const sessionKey = getSessionKey();

    if (!sessionKey) {
      throw new Error("Vault is locked. Unlock the vault before importing attachments.");
    }

    await saveAttachment(
      {
        title: file.name.replace(/\.[^/.]+$/, "") || file.name,
        description: "",
        caseId: caseFile.id,
        recordedAt: localDateTimeNowValue(),
      },
      file,
      sessionKey
    );
  };

  const handleCaseDrop = async (event: DragEvent<HTMLElement>, caseFile: CaseFile) => {
    event.preventDefault();
    setDropTargetCaseId(null);

    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length === 0) {
      return;
    }

    try {
      await Promise.all(droppedFiles.map((file) => addAttachmentToCase(caseFile, file)));
      await load();
    } catch (error) {
      setVerificationByCaseId((previous) => ({
        ...previous,
        [caseFile.id]: {
          loading: false,
          error: error instanceof Error ? error.message : "Failed to add dropped file(s)",
          report: previous[caseFile.id]?.report,
        },
      }));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return {
    cases,
    verificationByCaseId,
    exportByCaseId,
    previewMessageByCaseId,
    showStaleOnly,
    setShowStaleOnly,
    dropTargetCaseId,
    setDropTargetCaseId,
    ledgerHealth,
    staleCaseCount,
    totalEvidenceFiles,
    verificationCurrentCases,
    mismatchCount,
    visibleCases,
    load,
    exportCaseReport,
    handleCopyExportSummary,
    handleDownloadManifestPreview,
    verifyCaseEvidence,
    handleCaseDrop,
  };
}