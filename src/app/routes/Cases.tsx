import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import JSZip from "jszip";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import {
  getAttachmentByEvidenceItemId,
  listLedgerEntries,
  listCases,
  listEvidenceItemsForCase,
  updateCaseLastVerifiedAt,
} from "../../db/queries";
import { AddAttachmentButton } from "../../components/ui/AddAttachmentButton";
import { EmptyStateCard } from "../../components/ui/EmptyStateCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SeedDataButton } from "../../components/ui/SeedDataButton";
import { NewIncidentButton } from "../../components/ui/NewIncidentButton";
import { formatDisplayDateTime } from "../../lib/dates/format";
import { buildCaseTimeline, type TimelineEvent } from "../../features/cases/timeline";
import { buildCaseActivityTimeline } from "../../features/cases/activity";
import { generateCaseReportMarkdown } from "../../lib/export/caseReport";
import { downloadBlobFile } from "../../lib/utils/download";
import { type CaseIntegrityReport, verifyCaseEvidenceIntegrity } from "../../features/evidence/integrity";
import { saveAttachment } from "../../features/evidence/attachmentActions";
import { getLedgerHealth, type LedgerHealth } from "../../features/ledger/chain";
import { appendLedgerEvent } from "../../features/ledger/chain";
import { bakeRedactedImage } from "../../lib/utils/redactionBake";
import { useVault } from "../../features/vault/VaultContext";
import { loadDecryptedAttachmentByEvidenceItemId } from "../../features/vault/attachmentCrypto";

type CaseWithPreview = {
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

function verificationIcon(status: "verified" | "mismatch" | "unverifiable" | "skipped"): string {
  if (status === "verified") {
    return "✔";
  }

  if (status === "mismatch") {
    return "⚠";
  }

  if (status === "skipped") {
    return "↷";
  }

  return "•";
}

type CaseVerificationState = {
  loading: boolean;
  report?: CaseIntegrityReport;
  error?: string;
};

type CaseExportState = {
  loading: boolean;
  error?: string;
};

type CaseIntegrityStatus = "verified" | "stale" | "unverified" | "verifying";

function caseIntegrityStatus(
  caseFile: CaseFile,
  hasAttachments: boolean,
  isStaleVerification: boolean,
  isVerifying: boolean
): CaseIntegrityStatus {
  if (isVerifying) {
    return "verifying";
  }

  if (!hasAttachments || !caseFile.lastVerifiedAt) {
    return "unverified";
  }

  if (isStaleVerification) {
    return "stale";
  }

  return "verified";
}

function caseIntegrityLabel(status: CaseIntegrityStatus): string {
  if (status === "verified") {
    return "✓ Verified";
  }

  if (status === "stale") {
    return "⚠ Needs Verification";
  }

  if (status === "verifying") {
    return "⟳ Verifying...";
  }

  return "○ Unverified";
}

function caseIntegrityClassName(status: CaseIntegrityStatus): string {
  if (status === "verified") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "stale") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }

  if (status === "verifying") {
    return "border-blue-500/40 bg-blue-500/10 text-blue-200";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function attachmentIntegrityLabel(
  item: EvidenceItem,
  caseReport: CaseIntegrityReport | undefined,
  isVerifying: boolean,
  isStaleVerification: boolean
): string | null {
  const isAttachment = item.kind === "photo" || item.kind === "pdf" || item.kind === "audio";
  if (!isAttachment) {
    return null;
  }

  if (isVerifying) {
    return "⟳ Verifying...";
  }

  const reportItem = caseReport?.items.find((reportEntry) => reportEntry.evidenceId === item.id);
  if (reportItem?.status === "verified") {
    return "✓ Hash Verified";
  }

  if (reportItem?.status === "mismatch") {
    return "⚠ Hash Mismatch";
  }

  if (reportItem?.status === "skipped") {
    return "↷ Skipped (unchanged)";
  }

  if (reportItem?.status === "unverifiable") {
    return "⚠ Needs Verification";
  }

  return isStaleVerification ? "⚠ Needs Verification" : "✓ Hash Verified";
}

function localDateTimeNowValue(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ledgerStatusLabel(ledgerHealth: LedgerHealth | null): string {
  if (!ledgerHealth) {
    return "Checking...";
  }

  return ledgerHealth.chainValid ? "✓ Chain Valid" : "⚠ Integrity Error";
}

function sanitizeFileSegment(value: string): string {
  const sanitized = value
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");

  return sanitized.length > 0 ? sanitized : "evidence";
}

function withUniqueName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const extensionStart = name.lastIndexOf(".");
  const hasExtension = extensionStart > 0;
  const baseName = hasExtension ? name.slice(0, extensionStart) : name;
  const extension = hasExtension ? name.slice(extensionStart) : "";

  let index = 2;
  while (usedNames.has(`${baseName}_${index}${extension}`)) {
    index += 1;
  }

  const uniqueName = `${baseName}_${index}${extension}`;
  usedNames.add(uniqueName);
  return uniqueName;
}

function extensionFromMimeType(mimeType?: string): string {
  if (!mimeType) {
    return "";
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/jpeg") {
    return ".jpg";
  }

  if (mimeType === "application/pdf") {
    return ".pdf";
  }

  if (mimeType === "audio/mpeg") {
    return ".mp3";
  }

  if (mimeType === "audio/mp4") {
    return ".m4a";
  }

  if (mimeType === "audio/wav") {
    return ".wav";
  }

  return "";
}

export function Cases() {
  const { sessionKey } = useVault();
  const [cases, setCases] = useState<CaseWithPreview[]>([]);
  const [verificationByCaseId, setVerificationByCaseId] = useState<Record<string, CaseVerificationState>>({});
  const [exportByCaseId, setExportByCaseId] = useState<Record<string, CaseExportState>>({});
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [dropTargetCaseId, setDropTargetCaseId] = useState<string | null>(null);
  const [ledgerHealth, setLedgerHealth] = useState<LedgerHealth | null>(null);

  const staleCaseCount = useMemo(
    () => cases.filter((caseData) => caseData.isStaleVerification).length,
    [cases]
  );

  const totalEvidenceFiles = useMemo(
    () => cases.reduce((sum, caseData) => sum + caseData.caseItems.filter((item) => Boolean(item.fileRef)).length, 0),
    [cases]
  );

  const verificationCurrentCases = useMemo(
    () => cases.filter((caseData) => caseData.hasAttachments && !caseData.isStaleVerification).length,
    [cases]
  );

  const mismatchCount = useMemo(
    () =>
      Object.values(verificationByCaseId).reduce(
        (sum, verification) => sum + (verification.report?.mismatch ?? 0),
        0
      ),
    [verificationByCaseId]
  );

  const visibleCases = useMemo(
    () => (showStaleOnly ? cases.filter((caseData) => caseData.isStaleVerification) : cases),
    [cases, showStaleOnly]
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

        const newestAttachmentChangeEpoch = attachmentChangeEpochs.reduce<number | undefined>(
          (latest, current) => {
            if (current === undefined) {
              return latest;
            }

            if (latest === undefined) {
              return current;
            }

            return Math.max(latest, current);
          },
          undefined
        );

        const hasAttachments = newestAttachmentChangeEpoch !== undefined;
        const lastVerifiedEpoch = parseIsoToEpoch(caseFile.lastVerifiedAt);
        const isStaleVerification =
          hasAttachments &&
          (lastVerifiedEpoch === undefined ||
            (newestAttachmentChangeEpoch !== undefined && newestAttachmentChangeEpoch > lastVerifiedEpoch));

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
    timelineEvents: TimelineEvent[]
  ) => {
    setExportByCaseId((previous) => ({
      ...previous,
      [caseFile.id]: {
        loading: true,
      },
    }));

    try {
      const zip = new JSZip();
      const evidenceFolder = zip.folder("evidence");
      if (!evidenceFolder) {
        throw new Error("Unable to initialize evidence folder in export archive");
      }
      const redactedFolder = evidenceFolder.folder("redacted");
      if (!redactedFolder) {
        throw new Error("Unable to initialize redacted folder in export archive");
      }

      const usedOriginalNames = new Set<string>();
      const usedRedactedNames = new Set<string>();
      const caseAttachmentIds = new Set<string>();

      const evidenceMeta = await Promise.all(
        caseItems.map(async (evidence) => {
          if (!evidence.fileRef) {
            return { evidence, sizeBytes: undefined, mimeType: evidence.mimeType, sha256: evidence.sha256 };
          }

          const attachment = await loadDecryptedAttachmentByEvidenceItemId(evidence.id, sessionKey);
          if (!attachment) {
            return {
              evidence,
              sizeBytes: undefined,
              mimeType: evidence.mimeType,
              sha256: evidence.sha256,
            };
          }

          caseAttachmentIds.add(attachment.id);

          const baseOriginalName = sanitizeFileSegment(
            attachment.originalFilename || evidence.originalFilename || evidence.title || `${evidence.id}`
          );
          const originalName = withUniqueName(baseOriginalName, usedOriginalNames);
          evidenceFolder.file(originalName, attachment.blob);

          const hasRedactions = (evidence.redactions?.length ?? 0) > 0;
          if (hasRedactions) {
            const { bakedBlob, bakedHash } = await bakeRedactedImage(attachment.blob, evidence.redactions ?? []);
            const redactedBase = sanitizeFileSegment(
              `${(attachment.originalFilename || evidence.originalFilename || evidence.title || evidence.id).replace(/\.[^/.]+$/, "")}_redacted${extensionFromMimeType(bakedBlob.type || "image/png") || ".png"}`
            );
            const redactedName = withUniqueName(redactedBase, usedRedactedNames);
            redactedFolder.file(redactedName, bakedBlob);

            return {
              evidence,
              sizeBytes: bakedBlob.size,
              mimeType: bakedBlob.type || "image/png",
              sha256: bakedHash,
              isRedactedDerivative: true,
              originalSha256: evidence.sha256,
            };
          }

          return {
            evidence,
            sizeBytes: attachment.sizeBytes,
            mimeType: attachment.mimeType || evidence.mimeType,
            sha256: evidence.sha256,
          };
        })
      );

      const markdown = generateCaseReportMarkdown(caseFile, timelineEvents, evidenceMeta);
      zip.file("case-report.md", markdown);

      const ledgerEntries = await listLedgerEntries();
      const caseLedger = ledgerEntries.filter(
        (entry) => entry.caseId === caseFile.id || (entry.attachmentId ? caseAttachmentIds.has(entry.attachmentId) : false)
      );

      if (caseLedger.length > 0) {
        zip.file(
          "ledger-audit.json",
          JSON.stringify(
            {
              caseId: caseFile.id,
              caseTitle: caseFile.title,
              exportedAt: new Date().toISOString(),
              entries: caseLedger,
            },
            null,
            2
          )
        );
      }

      const safeName = caseFile.title
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, "");
      const fileName = `${safeName || "case-report"}-export.zip`;

      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

      downloadBlobFile(fileName, zipBlob);

      setExportByCaseId((previous) => ({
        ...previous,
        [caseFile.id]: {
          loading: false,
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

  const verifyCaseEvidence = async (caseFile: CaseFile, caseItems: EvidenceItem[]) => {
    setVerificationByCaseId((previous) => ({
      ...previous,
      [caseFile.id]: {
        loading: true,
      },
    }));

    try {
      const report = await verifyCaseEvidenceIntegrity(caseItems, (evidenceItem) =>
        loadDecryptedAttachmentByEvidenceItemId(evidenceItem.id, sessionKey),
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

  return (
    <section>
      <SectionHeader
        title={showStaleOnly ? "Cases (stale only)" : "Cases"}
        subtitle={`${cases.length} cases • ${staleCaseCount} stale`}
        rightSlot={
          <div className="flex items-center gap-2">
            <NewIncidentButton />
            <AddAttachmentButton />
            <button
              type="button"
              onClick={() => setShowStaleOnly((previous) => !previous)}
              className={[
                "rounded-md border px-3 py-2 text-xs",
                showStaleOnly
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
              ].join(" ")}
            >
              {showStaleOnly ? "Showing Stale Only" : `Stale Only (${staleCaseCount})`}
            </button>
            <SeedDataButton onSeeded={load} />
          </div>
        }
      />

      <section className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="pv-card">
          <p className="text-xs text-zinc-400">Cases</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{cases.length}</p>
        </div>
        <div className="pv-card">
          <p className="text-xs text-zinc-400">Evidence Files</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{totalEvidenceFiles}</p>
        </div>
        <div className="pv-card">
          <p className="text-xs text-zinc-400">Verification Current</p>
          <p className="mt-1 text-lg font-semibold text-emerald-300">{verificationCurrentCases}</p>
        </div>
        <div className="pv-card">
          <p className="text-xs text-zinc-400">Stale</p>
          <p className="mt-1 text-lg font-semibold text-amber-300">{staleCaseCount}</p>
        </div>
        <div className="pv-card">
          <p className="text-xs text-zinc-400">Mismatch (latest run)</p>
          <p className="mt-1 text-lg font-semibold text-red-300">{mismatchCount}</p>
        </div>
        <div className="pv-card">
          <p className="text-xs text-zinc-400">Vault Ledger</p>
          <p
            className={[
              "mt-1 text-sm font-semibold",
              ledgerHealth?.chainValid ? "text-emerald-300" : "text-amber-300",
            ].join(" ")}
          >
            {ledgerStatusLabel(ledgerHealth)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Entries: {ledgerHealth?.entries ?? 0}</p>
          {ledgerHealth?.lastEventAt ? (
            <p className="text-xs text-zinc-500">Last: {formatDisplayDateTime(ledgerHealth.lastEventAt)}</p>
          ) : null}
          {ledgerHealth?.vaultRootHash ? (
            <p className="text-xs text-zinc-500">Root: {ledgerHealth.vaultRootHash}</p>
          ) : null}
        </div>
      </section>

      {visibleCases.length === 0 ? (
        <EmptyStateCard
          title={showStaleOnly ? "No stale cases" : "No cases yet"}
          description={
            showStaleOnly
              ? "All case verifications are current, or there are no attachment-backed cases."
              : "Seed test data to validate list shape and route behavior."
          }
          action={<AddAttachmentButton />}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visibleCases.map(({ caseFile, caseItems, timelineEvents, hasAttachments, isStaleVerification }) => {
            const caseVerification = verificationByCaseId[caseFile.id];
            const caseExport = exportByCaseId[caseFile.id];
            const caseReport = caseVerification?.report;

            const integrityStatus = caseIntegrityStatus(
              caseFile,
              hasAttachments,
              isStaleVerification,
              Boolean(caseVerification?.loading)
            );

            return (
            <li key={caseFile.id} className="pv-card">
              <h3 className="text-sm font-semibold text-zinc-100">{caseFile.title}</h3>
              <p className="mt-1 text-xs text-zinc-400">{caseFile.type}</p>
              <p className="mt-2 text-xs text-zinc-500">Status: {caseFile.status}</p>
              <p className="mt-2 text-xs text-zinc-500">Evidence count: {caseItems.length}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Last Verified: {caseFile.lastVerifiedAt ? formatDisplayDateTime(caseFile.lastVerifiedAt) : "never"}
              </p>
              {hasAttachments ? (
                <p
                  className={[
                    "mt-1 inline-block rounded-md border px-2 py-1 text-xs",
                    caseIntegrityClassName(integrityStatus),
                  ].join(" ")}
                >
                  {caseIntegrityLabel(integrityStatus)}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void exportCaseReport(caseFile, caseItems, timelineEvents)}
                disabled={caseExport?.loading}
                className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {caseExport?.loading ? "Exporting..." : "Export Case Report"}
              </button>
              {caseExport?.error ? <p className="mt-2 text-xs text-red-300">{caseExport.error}</p> : null}
              <button
                type="button"
                onClick={() => void verifyCaseEvidence(caseFile, caseItems)}
                disabled={caseVerification?.loading}
                className="mt-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {caseVerification?.loading ? "Verifying..." : "Verify Case Evidence"}
              </button>

              {caseVerification?.error ? (
                <p className="mt-2 text-xs text-red-300">{caseVerification.error}</p>
              ) : null}

              {caseReport ? (
                <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-xs text-zinc-300">
                  <p className="font-semibold text-zinc-200">Evidence Integrity Report</p>
                  <p className="mt-1 text-zinc-400">
                    Checked: {formatDisplayDateTime(caseReport.checkedAt)}
                  </p>
                  <p className="mt-1 text-zinc-400">
                    Verified {caseReport.verified}/{caseReport.total} · Mismatch {caseReport.mismatch} ·
                    Unverifiable {caseReport.unverifiable} · Skipped {caseReport.skipped}
                  </p>
                  <p className="mt-1 text-zinc-400">
                    Rehashed {caseReport.changed} items ({caseReport.canUpdateLastVerifiedAt ? "case marked verified" : "verification incomplete"})
                  </p>
                  <ul className="mt-2 space-y-1">
                    {caseReport.items.map((item) => (
                      <li key={item.evidenceId} className="text-zinc-300">
                        {verificationIcon(item.status)} {item.title}
                      </li>
                    ))}

                    <p className="mt-3 text-xs text-zinc-400">Case activity</p>
                    {(() => {
                      const activityEvents = buildCaseActivityTimeline(caseFile, caseItems, caseReport);

                      if (activityEvents.length === 0) {
                        return <p className="mt-1 text-xs text-zinc-500">No case activity yet.</p>;
                      }

                      const recentEvents = activityEvents.slice(-6);

                      return (
                        <ul className="mt-2 space-y-2 border-l border-zinc-800 pl-3">
                          {recentEvents.map((activity) => (
                            <li key={activity.id} className="relative">
                              <span className="absolute -left-[18px] mt-1 h-2 w-2 rounded-full bg-zinc-500" />
                              <p className="text-xs text-zinc-500">{formatDisplayDateTime(activity.timestamp)}</p>
                              <p className="text-sm text-zinc-200">{activity.label}</p>
                              {activity.details ? <p className="text-xs text-zinc-500">{activity.details}</p> : null}
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                onDrop={(event) => void handleCaseDrop(event, caseFile)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTargetCaseId(caseFile.id);
                }}
                onDragLeave={() => setDropTargetCaseId((previous) => (previous === caseFile.id ? null : previous))}
                aria-label={`Drop files to add evidence to case ${caseFile.title}`}
                className={[
                  "mt-3 w-full rounded-md border border-dashed px-3 py-2 text-left text-xs",
                  dropTargetCaseId === caseFile.id
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-700 text-zinc-400",
                ].join(" ")}
              >
                Drop files here to add evidence
              </button>

              <p className="mt-3 text-xs text-zinc-400">Case timeline</p>
              {timelineEvents.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">No linked items yet.</p>
              ) : (
                <ul className="mt-2 space-y-2 border-l border-zinc-800 pl-3">
                  {timelineEvents.map((event) => {
                    const sourceItem = caseItems.find((item) => item.id === event.referenceId);
                    const integrity = sourceItem
                      ? attachmentIntegrityLabel(
                          sourceItem,
                          caseReport,
                          Boolean(caseVerification?.loading),
                          isStaleVerification
                        )
                      : null;

                    return (
                      <li key={event.id} className="relative">
                        <span className="absolute -left-[18px] mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                        <p className="text-xs text-zinc-500">{formatDisplayDateTime(event.timestamp)}</p>
                        <Link to={`/evidence/${event.referenceId}`} className="text-sm text-zinc-100 hover:text-emerald-300">
                          {event.title}
                        </Link>
                        {integrity ? <p className="text-xs text-zinc-500">{integrity}</p> : null}
                        <p className="text-xs text-zinc-400">
                          {event.type} · {event.kind}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
