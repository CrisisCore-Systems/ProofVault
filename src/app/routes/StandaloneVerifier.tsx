import { useState, type ComponentProps } from "react";
import { EmptyStateCard } from "../../components/ui/EmptyStateCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { printClinicalVerificationCertificate } from "../../lib/export/clinicalReportPdf";
import { verifyProofVaultEvidenceManifest, parseProofVaultEvidenceManifest } from "../../lib/export/proofVerifier";
import { readVerificationSnapshotFromBackup, type BackupVerificationSnapshot } from "../../features/security/backup";
import {
  buildVerificationReport,
  buildVerificationReportFileNameFromMetadata,
  type VerificationReport,
} from "../../lib/export/verificationReport";
import { downloadTextFile } from "../../lib/utils/download";
import { VerifierResultsPanel } from "./exports/VerifierResultsPanel";

function BackupSnapshotSummary({ snapshot }: Readonly<{ snapshot: BackupVerificationSnapshot }>) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/80 p-4">
      <div>
        <h4 className="text-sm font-semibold text-zinc-100">Backup snapshot</h4>
        <p className="mt-1 text-xs text-zinc-400">
          Read-only verification source. No records are imported into the local vault.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-zinc-300">
          Cases: {snapshot.cases.length}
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-zinc-300">
          Evidence: {snapshot.evidenceItems.length}
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-zinc-300">
          Ledger: {snapshot.ledger.length}
        </div>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
        <p>Exported: {snapshot.exportedAt}</p>
        <p className="mt-1 break-all">Snapshot SHA-256: {snapshot.snapshotSha256}</p>
      </div>
    </div>
  );
}

function selectRelevantEvidenceIds(manifestText: ReturnType<typeof parseProofVaultEvidenceManifest>) {
  return new Set(manifestText.evidenceRecords.map((record) => record.sourceId));
}

export function StandaloneVerifier() {
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<BackupVerificationSnapshot | null>(null);
  const [manifest, setManifest] = useState<ReturnType<typeof parseProofVaultEvidenceManifest> | null>(null);
  const [verification, setVerification] = useState<Awaited<
    ReturnType<typeof verifyProofVaultEvidenceManifest>
  > | null>(null);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);

  const clearResults = () => {
    setError(null);
    setSuccess(null);
    setSnapshot(null);
    setManifest(null);
    setVerification(null);
    setVerificationReport(null);
  };

  const runVerification = async (manifestSourceFile: File, backupSourceFile: File) => {
    const parsedManifest = parseProofVaultEvidenceManifest(await manifestSourceFile.text());
    const hydratedSnapshot = await readVerificationSnapshotFromBackup(
      backupSourceFile,
      backupPassphrase,
      vaultPassphrase
    );
    const relevantEvidenceIds = selectRelevantEvidenceIds(parsedManifest);
    const relevantItems = hydratedSnapshot.evidenceItems.filter((item) => relevantEvidenceIds.has(item.id));
    const matchedCase = hydratedSnapshot.cases.find((caseFile) => caseFile.id === parsedManifest.caseId);
    const result = await verifyProofVaultEvidenceManifest({
      manifest: parsedManifest,
      caseFile: matchedCase,
      items: relevantItems,
    });
    const report = await buildVerificationReport({
      manifest: parsedManifest,
      caseTitle: matchedCase?.title,
      verification: result,
      verificationSource: "backup-snapshot",
      backupSnapshot: hydratedSnapshot,
    });

    setManifest(parsedManifest);
    setSnapshot(hydratedSnapshot);
    setVerification(result);
    setVerificationReport(report);
    setSuccess(
      result.status === "verified"
        ? "Proof manifest verified against the supplied backup snapshot."
        : "Verification completed with findings. Review the report before trusting this export."
    );
  };

  const handleDownloadReport = () => {
    if (!manifest || !verification) {
      setError("Run a verification check before downloading a report.");
      return;
    }

    const run = async () => {
      try {
        const report =
          verificationReport ??
          (await buildVerificationReport({
            manifest,
            caseTitle: snapshot?.cases.find((caseFile) => caseFile.id === manifest.caseId)?.title,
            verification,
            verificationSource: "backup-snapshot",
            backupSnapshot: snapshot ?? undefined,
          }));
        const fileName = buildVerificationReportFileNameFromMetadata({
          caseId: report.manifest.caseId,
          caseTitle: report.manifest.caseTitle,
          exportedAt: report.manifest.exportedAt,
        });
        downloadTextFile(fileName, JSON.stringify(report, null, 2), "application/json;charset=utf-8");

        setSuccess(`Verification report downloaded: ${fileName}`);
        setError(null);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to download verification report.");
      }
    };

    void run();
  };

  const handlePrintCertificate = () => {
    if (!manifest || !verification) {
      setError("Run a verification check before printing a certificate.");
      return;
    }

    const run = async () => {
      try {
        const report =
          verificationReport ??
          (await buildVerificationReport({
            manifest,
            caseTitle: snapshot?.cases.find((caseFile) => caseFile.id === manifest.caseId)?.title,
            verification,
            verificationSource: "backup-snapshot",
            backupSnapshot: snapshot ?? undefined,
          }));

        printClinicalVerificationCertificate(report);
        setSuccess("Clinical verification certificate opened for printing.");
        setError(null);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to print clinical certificate.");
      }
    };

    void run();
  };

  const handleVerify: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    clearResults();

    if (!manifestFile) {
      setError("Choose a proof manifest file to continue.");
      return;
    }

    if (!backupFile) {
      setError("Choose an encrypted backup file to continue.");
      return;
    }

    const run = async () => {
      setVerifying(true);

      try {
        await runVerification(manifestFile, backupFile);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to verify the supplied files.");
      } finally {
        setVerifying(false);
      }
    };

    void run();
  };

  return (
    <section>
      <SectionHeader
        title="Standalone Verifier"
        subtitle="Verify a proof manifest against an encrypted vault backup without importing any data into the local database"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <form onSubmit={handleVerify} className="pv-card space-y-4">
          <div>
            <h3 className="pv-section-title">Verification inputs</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Supply the exported proof manifest, the encrypted backup, the backup passphrase, and the vault passphrase used to unlock the original vault.
            </p>
          </div>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Proof manifest file</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                setManifestFile(event.target.files?.[0] ?? null);
                clearResults();
              }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-200"
              required
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Encrypted backup file</span>
            <input
              type="file"
              accept=".pvault,.json,application/json"
              onChange={(event) => {
                setBackupFile(event.target.files?.[0] ?? null);
                clearResults();
              }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-200"
              required
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Backup passphrase</span>
            <input
              type="password"
              value={backupPassphrase}
              onChange={(event) => {
                setBackupPassphrase(event.target.value);
                clearResults();
              }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
              autoComplete="current-password"
              required
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Vault passphrase</span>
            <input
              type="password"
              value={vaultPassphrase}
              onChange={(event) => {
                setVaultPassphrase(event.target.value);
                clearResults();
              }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-xs text-zinc-400">
            This flow is read-only. The backup is decrypted in-browser, the manifest is checked in-memory, and no imported records are written into this device's vault.
          </div>

          {error ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
          ) : null}

          {success ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{success}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={verifying || verification === null || manifest === null}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Download Verification Report
            </button>
            <button
              type="submit"
              disabled={verifying}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? "Verifying..." : "Verify External Proof"}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {snapshot ? <BackupSnapshotSummary snapshot={snapshot} /> : null}
          {manifest ? (
            <VerifierResultsPanel
              manifest={manifest}
              verification={verification}
              verificationReport={verificationReport}
              verifying={verifying}
              onDownloadReport={handleDownloadReport}
              onPrintCertificate={handlePrintCertificate}
            />
          ) : (
            <EmptyStateCard
              title="No verification run yet"
              description="Provide a proof manifest and encrypted backup, then run the verifier to inspect the chain of custody."
            />
          )}
        </div>
      </div>
    </section>
  );
}