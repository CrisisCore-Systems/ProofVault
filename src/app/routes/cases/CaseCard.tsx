import type { Dispatch, DragEvent, SetStateAction } from "react";
import { Link } from "react-router-dom";
import type { CaseFile, EvidenceItem } from "../../../domain/types";
import { formatDisplayDateTime } from "../../../lib/dates/format";
import type { TimelineEvent } from "../../../features/cases/timeline";
import { buildCaseActivityTimeline } from "../../../features/cases/activity";
import type { CaseIntegrityReport } from "../../../features/evidence/integrity";

export type CaseVerificationState = {
  loading: boolean;
  report?: CaseIntegrityReport;
  error?: string;
};

export type CaseExportState = {
  loading: boolean;
  error?: string;
  success?: string;
  archiveRef?: string;
  exportedAt?: string;
};

type CaseIntegrityStatus = "verified" | "stale" | "unverified" | "verifying";

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

type CaseIntegrityReportPanelProps = {
  caseFile: CaseFile;
  caseItems: EvidenceItem[];
  caseReport: CaseIntegrityReport;
};

function CaseIntegrityReportPanel({
  caseFile,
  caseItems,
  caseReport,
}: Readonly<CaseIntegrityReportPanelProps>) {
  const activityEvents = buildCaseActivityTimeline(caseFile, caseItems, caseReport);
  const recentEvents = activityEvents.slice(-6);

  return (
    <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-xs text-zinc-300">
      <p className="font-semibold text-zinc-200">Evidence Integrity Report</p>
      <p className="mt-1 text-zinc-400">Checked: {formatDisplayDateTime(caseReport.checkedAt)}</p>
      <p className="mt-1 text-zinc-400">
        Verified {caseReport.verified}/{caseReport.total} · Mismatch {caseReport.mismatch} · Unverifiable {caseReport.unverifiable} · Skipped {caseReport.skipped}
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
      </ul>

      <p className="mt-3 text-xs text-zinc-400">Case activity</p>
      {recentEvents.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">No case activity yet.</p>
      ) : (
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
      )}
    </div>
  );
}

type CaseTimelineListProps = {
  caseItems: EvidenceItem[];
  timelineEvents: TimelineEvent[];
  caseReport?: CaseIntegrityReport;
  isVerifying: boolean;
  isStaleVerification: boolean;
};

function CaseTimelineList({
  caseItems,
  timelineEvents,
  caseReport,
  isVerifying,
  isStaleVerification,
}: Readonly<CaseTimelineListProps>) {
  if (timelineEvents.length === 0) {
    return <p className="mt-1 text-xs text-zinc-500">No linked items yet.</p>;
  }

  return (
    <ul className="mt-2 space-y-2 border-l border-zinc-800 pl-3">
      {timelineEvents.map((event) => {
        const sourceItem = caseItems.find((item) => item.id === event.referenceId);
        const integrity = sourceItem
          ? attachmentIntegrityLabel(sourceItem, caseReport, isVerifying, isStaleVerification)
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
  );
}

export type CaseCardProps = {
  caseFile: CaseFile;
  caseItems: EvidenceItem[];
  timelineEvents: TimelineEvent[];
  hasAttachments: boolean;
  isStaleVerification: boolean;
  caseVerification?: CaseVerificationState;
  caseExport?: CaseExportState;
  previewMessage?: string;
  dropTargetCaseId: string | null;
  onSetDropTargetCaseId: Dispatch<SetStateAction<string | null>>;
  onExportCaseReport: (caseFile: CaseFile, caseItems: EvidenceItem[], timelineEvents: TimelineEvent[]) => Promise<void>;
  onCopyExportSummary: (caseFile: CaseFile, caseItems: EvidenceItem[]) => Promise<void>;
  onDownloadManifestPreview: (caseFile: CaseFile, caseItems: EvidenceItem[]) => void;
  onVerifyCaseEvidence: (caseFile: CaseFile, caseItems: EvidenceItem[]) => Promise<void>;
  onHandleCaseDrop: (event: DragEvent<HTMLElement>, caseFile: CaseFile) => Promise<void>;
};

export function CaseCard({
  caseFile,
  caseItems,
  timelineEvents,
  hasAttachments,
  isStaleVerification,
  caseVerification,
  caseExport,
  previewMessage,
  dropTargetCaseId,
  onSetDropTargetCaseId,
  onExportCaseReport,
  onCopyExportSummary,
  onDownloadManifestPreview,
  onVerifyCaseEvidence,
  onHandleCaseDrop,
}: Readonly<CaseCardProps>) {
  const caseReport = caseVerification?.report;
  const isVerifying = Boolean(caseVerification?.loading);
  const integrityStatus = caseIntegrityStatus(caseFile, hasAttachments, isStaleVerification, isVerifying);

  return (
    <li className="pv-card">
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
        onClick={() => void onExportCaseReport(caseFile, caseItems, timelineEvents)}
        disabled={caseExport?.loading}
        className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {caseExport?.loading ? "Exporting..." : "Export Case Report"}
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onCopyExportSummary(caseFile, caseItems)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Copy Summary
        </button>
        <button
          type="button"
          onClick={() => onDownloadManifestPreview(caseFile, caseItems)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Download Manifest Preview
        </button>
      </div>
      {previewMessage ? <p className="mt-2 text-xs text-zinc-400">{previewMessage}</p> : null}
      {caseExport?.error ? <p className="mt-2 text-xs text-red-300">{caseExport.error}</p> : null}
      {caseExport?.success ? (
        <div className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <p>{caseExport.success}</p>
          {caseExport.exportedAt ? (
            <p className="mt-1 text-emerald-300/90">Generated: {formatDisplayDateTime(caseExport.exportedAt)}</p>
          ) : null}
          {caseExport.archiveRef ? <p className="mt-1 break-all text-emerald-300/90">Archive: {caseExport.archiveRef}</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void onVerifyCaseEvidence(caseFile, caseItems)}
        disabled={caseVerification?.loading}
        className="mt-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {caseVerification?.loading ? "Verifying..." : "Verify Case Evidence"}
      </button>

      {caseVerification?.error ? <p className="mt-2 text-xs text-red-300">{caseVerification.error}</p> : null}

      {caseReport ? <CaseIntegrityReportPanel caseFile={caseFile} caseItems={caseItems} caseReport={caseReport} /> : null}

      <button
        type="button"
        onDrop={(event) => void onHandleCaseDrop(event, caseFile)}
        onDragOver={(event) => {
          event.preventDefault();
          onSetDropTargetCaseId(caseFile.id);
        }}
        onDragLeave={() => onSetDropTargetCaseId((previous) => (previous === caseFile.id ? null : previous))}
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
      <CaseTimelineList
        caseItems={caseItems}
        timelineEvents={timelineEvents}
        caseReport={caseReport}
        isVerifying={isVerifying}
        isStaleVerification={isStaleVerification}
      />
    </li>
  );
}
