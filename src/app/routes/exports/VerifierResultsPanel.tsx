import type { ProofVaultManifestVerificationResult } from "../../../lib/export/proofVerifier";
import { translateProofVaultRedactionPolicy } from "../../../lib/export/policyTranslator";
import type { VerificationReport } from "../../../lib/export/verificationReport";
import type { ProofVaultEvidenceManifest } from "../../../types/proof-vault";
import { CompactIntegrityHeader } from "./CompactIntegrityHeader";

type VerifierResultsPanelProps = {
  manifest: ProofVaultEvidenceManifest | null;
  verification: ProofVaultManifestVerificationResult | null;
  verificationReport: VerificationReport | null;
  verifying: boolean;
  onDownloadReport: () => void;
  onPrintCertificate: () => void;
};

function hashSnippet(hash: string): string {
  if (hash.length <= 24) {
    return hash;
  }

  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

function resolveVerifierStatus(verification: ProofVaultManifestVerificationResult | null, verifying: boolean) {
  if (verifying) {
    return {
      label: "Verifying proof",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    };
  }

  if (verification?.status === "verified") {
    return {
      label: "Verified",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (verification) {
    return {
      label: "Issues found",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    };
  }

  return {
    label: "Ready to verify",
    className: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
  };
}

function VerificationSummary({ verification }: Readonly<{ verification: ProofVaultManifestVerificationResult }>) {
  return (
    <div className="grid gap-2 sm:grid-cols-4 text-xs">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-300">
        Verified: {verification.verified}
      </div>
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-300">
        Mismatched: {verification.mismatched}
      </div>
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-300">
        Missing: {verification.missing}
      </div>
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-300">
        Seal: {verification.manifestSealValid ? "valid" : "invalid"}
      </div>
    </div>
  );
}

function VerificationIssues({ verification }: Readonly<{ verification: ProofVaultManifestVerificationResult }>) {
  if (verification.issues.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-100">
      <p className="font-semibold">Manifest issues</p>
      <ul className="mt-2 space-y-1 text-rose-100/90">
        {verification.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

function VerificationRecordFindings({ verification }: Readonly<{ verification: ProofVaultManifestVerificationResult }>) {
  const findings = verification.records.filter((record) => record.issues.length > 0).slice(0, 4);

  if (findings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Record findings</p>
      <ul className="space-y-2">
        {findings.map((record) => (
          <li key={record.sourceId} className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            <p className="font-semibold text-zinc-100">{record.sourceId}</p>
            <p className="mt-1 text-zinc-500">{record.status}</p>
            <ul className="mt-2 space-y-1 text-zinc-400">
              {record.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PolicySummary({ manifest }: Readonly<{ manifest: ProofVaultEvidenceManifest }>) {
  const policy = manifest.evidenceRecords[0]?.exportContext.redactionPolicy;
  const translation = translateProofVaultRedactionPolicy(policy ?? null);

  if (!policy || !translation) {
    return null;
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-xs text-zinc-300">
      <p className="font-semibold text-zinc-100">{translation.heading}</p>
      <p className="mt-2 text-zinc-400">{translation.summary}</p>
      <p className="mt-2 text-zinc-400">{translation.attachmentHandling}</p>
      <p className="mt-1 text-zinc-400">{translation.metadataAppendixHandling}</p>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-widest text-zinc-500">Omitted by policy</p>
        {translation.omittedFieldLabels.length > 0 ? (
          <ul className="mt-2 space-y-1 text-zinc-300">
            {translation.omittedFieldLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-zinc-500">No fields were omitted by policy.</p>
        )}
      </div>
    </div>
  );
}

export function VerifierResultsPanel({
  manifest,
  verification,
  verificationReport,
  verifying,
  onDownloadReport,
  onPrintCertificate,
}: Readonly<VerifierResultsPanelProps>) {
  if (!manifest) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-950/80 p-4 text-xs text-zinc-500">
        Choose a case to inspect the proof manifest preview.
      </div>
    );
  }

  const status = resolveVerifierStatus(verification, verifying);

  return (
    <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">Proof verifier</h4>
          <p className="mt-1 text-xs text-zinc-400">
            Validate the manifest seal and recompute source provenance before sharing the export.
          </p>
        </div>
        <span className={["rounded-full border px-2 py-1 text-[11px]", status.className].join(" ")}>
          {status.label}
        </span>
      </div>

      {verificationReport ? (
        <CompactIntegrityHeader
          manifestSeal={manifest.integritySeal}
          reportSha256={verificationReport.reportSha256}
        />
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Records</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{manifest.recordCount}</p>
          <p className="text-xs text-zinc-500">Proof records in preview</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Archive seal</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">{hashSnippet(manifest.integritySeal)}</p>
          <p className="text-xs text-zinc-500">Top-level manifest seal</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Output</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{manifest.outputFormat}</p>
          <p className="text-xs text-zinc-500">{manifest.exportedAt}</p>
        </div>
      </div>

      <PolicySummary manifest={manifest} />

      {verification ? (
        <>
          <VerificationSummary verification={verification} />
          <VerificationIssues verification={verification} />
          <VerificationRecordFindings verification={verification} />

          <div className="flex justify-end">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPrintCertificate}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                Print Clinical Certificate
              </button>
              <button
                type="button"
                onClick={onDownloadReport}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                Download Verification Report
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-zinc-500">
          Run the verifier to confirm the archive seal and source provenance still match the live vault.
        </p>
      )}
    </div>
  );
}