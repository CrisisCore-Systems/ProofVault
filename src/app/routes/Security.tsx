import { useEffect, useState, type ComponentProps } from "react";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAppLock } from "../../features/security/AppLock";
import { buildPassphrasePolicyFeedback } from "../../features/security/passphrasePolicy";
import {
  exportEncryptedBackup,
  importEncryptedBackup,
  listRollbackSnapshots,
  previewEncryptedBackup,
  restoreRollbackSnapshot,
  type RollbackSnapshotSummary,
  type StagedVaultRestore,
  type VaultBackupPreview,
} from "../../features/security/backup";

type SessionBehaviorCardProps = {
  idleTimeoutMinutes: number;
  lockOnHidden: boolean;
  onChangeIdleTimeout: (minutes: number) => void;
  onChangeLockOnHidden: (value: boolean) => void;
};

function SessionBehaviorCard({
  idleTimeoutMinutes,
  lockOnHidden,
  onChangeIdleTimeout,
  onChangeLockOnHidden,
}: Readonly<SessionBehaviorCardProps>) {
  return (
    <section className="pv-card space-y-4">
      <div>
        <h3 className="pv-section-title">Session behavior</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Choose how long the vault stays open while idle and whether it locks when the tab becomes hidden.
        </p>
      </div>

      <label className="block text-sm text-zinc-200">
        <span className="mb-1 block">Auto-lock timeout</span>
        <select
          value={idleTimeoutMinutes}
          onChange={(event) => onChangeIdleTimeout(Number(event.target.value))}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
        >
          <option value={5}>5 minutes</option>
          <option value={10}>10 minutes</option>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
        </select>
      </label>

      <label className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={lockOnHidden}
          onChange={(event) => onChangeLockOnHidden(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
        />
        <span>Lock vault when the tab is hidden</span>
      </label>

      <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-xs text-zinc-400">
        <p>Local-only app lock: the passphrase never leaves the device.</p>
        <p className="mt-1">If the tab closes or navigation unloads the page, the in-memory session key is cleared.</p>
      </div>
    </section>
  );
}

type RotationCardProps = {
  onRotatePassphrase: (currentPassphrase: string, nextPassphrase: string) => Promise<void>;
};

function RotationCard({ onRotatePassphrase }: Readonly<RotationCardProps>) {
  const passphraseFeedback = buildPassphrasePolicyFeedback("vault");
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [nextPassphrase, setNextPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [rotationSuccess, setRotationSuccess] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const handleRotateSubmit: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    setRotationError(null);
    setRotationSuccess(null);

    if (nextPassphrase !== confirmPassphrase) {
      setRotationError("New passphrases do not match.");
      return;
    }

    const run = async () => {
      setRotating(true);

      try {
        await onRotatePassphrase(currentPassphrase, nextPassphrase);
        setRotationSuccess("Passphrase updated. Sensitive records were re-keyed locally.");
        setCurrentPassphrase("");
        setNextPassphrase("");
        setConfirmPassphrase("");
      } catch (error) {
        setRotationError(error instanceof Error ? error.message : "Unable to rotate passphrase.");
      } finally {
        setRotating(false);
      }
    };

    void run();
  };

  return (
    <section className="pv-card space-y-4">
      <div>
        <h3 className="pv-section-title">Rotate passphrase</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Re-encrypt all protected records with a new passphrase-derived key without exporting any data.
        </p>
      </div>

      <form onSubmit={handleRotateSubmit} className="space-y-3">
        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">Current passphrase</span>
          <input
            type="password"
            value={currentPassphrase}
            onChange={(event) => setCurrentPassphrase(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            autoComplete="current-password"
            required
          />
        </label>

        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">New passphrase</span>
          <input
            type="password"
            value={nextPassphrase}
            onChange={(event) => setNextPassphrase(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block text-sm text-zinc-200">
          <span className="mb-1 block">Confirm new passphrase</span>
          <input
            type="password"
            value={confirmPassphrase}
            onChange={(event) => setConfirmPassphrase(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            autoComplete="new-password"
            required
          />
        </label>

        {rotationError ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {rotationError}
          </p>
        ) : null}

        {rotationSuccess ? (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {rotationSuccess}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={rotating}
            className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rotating ? "Rotating..." : "Rotate Passphrase"}
          </button>
        </div>
      </form>

      <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-xs text-zinc-400">
        <p>{passphraseFeedback.guidance[0]}</p>
        <p className="mt-1">{passphraseFeedback.guidance[2]}</p>
        <p className="mt-1 text-amber-300">{passphraseFeedback.warnings[0]}</p>
      </div>
    </section>
  );
}

function BackupExportCard() {
  const passphraseFeedback = buildPassphrasePolicyFeedback("backup");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupConfirmPassphrase, setBackupConfirmPassphrase] = useState("");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [exportingBackup, setExportingBackup] = useState(false);

  const handleBackupExport: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    setBackupError(null);
    setBackupSuccess(null);

    if (backupPassphrase !== backupConfirmPassphrase) {
      setBackupError("Backup passphrases do not match.");
      return;
    }

    const run = async () => {
      setExportingBackup(true);

      try {
        await exportEncryptedBackup(backupPassphrase);
        setBackupSuccess("Encrypted backup downloaded. Store the backup file and its passphrase safely.");
        setBackupPassphrase("");
        setBackupConfirmPassphrase("");
      } catch (error) {
        setBackupError(error instanceof Error ? error.message : "Unable to export encrypted backup.");
      } finally {
        setExportingBackup(false);
      }
    };

    void run();
  };

  return (
    <form onSubmit={handleBackupExport} className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/80 p-4">
      <div>
        <h4 className="text-sm font-semibold text-zinc-100">Create encrypted backup</h4>
        <p className="mt-1 text-xs text-zinc-400">
          Downloads a `.pvault` file containing the full local vault and security configuration.
        </p>
      </div>

      <label className="block text-sm text-zinc-200">
        <span className="mb-1 block">Backup passphrase</span>
        <input
          type="password"
          value={backupPassphrase}
          onChange={(event) => setBackupPassphrase(event.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          autoComplete="new-password"
          required
        />
      </label>

      <label className="block text-sm text-zinc-200">
        <span className="mb-1 block">Confirm backup passphrase</span>
        <input
          type="password"
          value={backupConfirmPassphrase}
          onChange={(event) => setBackupConfirmPassphrase(event.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          autoComplete="new-password"
          required
        />
      </label>

      {backupError ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{backupError}</p>
      ) : null}

      {backupSuccess ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {backupSuccess}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={exportingBackup}
          className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exportingBackup ? "Preparing..." : "Download Backup"}
        </button>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-xs text-zinc-400">
        <p>{passphraseFeedback.guidance[0]}</p>
        <p className="mt-1">{passphraseFeedback.guidance[1]}</p>
        <p className="mt-1 text-amber-300">{passphraseFeedback.warnings[0]}</p>
      </div>
    </form>
  );
}

function BackupRestoreCard() {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreAttachments, setRestoreAttachments] = useState(true);
  const [restoreExportBundles, setRestoreExportBundles] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreWarning, setRestoreWarning] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<VaultBackupPreview | null>(null);
  const [stagedRestore, setStagedRestore] = useState<StagedVaultRestore | null>(null);
  const [previewingBackup, setPreviewingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);

  const clearRestoreState = () => {
    setRestoreError(null);
    setRestoreWarning(null);
    setRestorePreview(null);
    setStagedRestore(null);
  };

  const handleBackupPreview: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    clearRestoreState();

    if (!restoreFile) {
      setRestoreError("Choose a backup file to continue.");
      return;
    }

    const run = async () => {
      setPreviewingBackup(true);

      try {
        const preview = await previewEncryptedBackup(restoreFile, restorePassphrase, {
          includeAttachments: restoreAttachments,
          includeExportBundles: restoreExportBundles,
        });
        setRestorePreview(preview);
        setRestoreWarning("Backup preview verified. Restores now stage into a temporary namespace before promotion.");
      } catch (error) {
        setRestoreError(error instanceof Error ? error.message : "Unable to preview encrypted backup.");
      } finally {
        setPreviewingBackup(false);
      }
    };

    void run();
  };

  const handleBackupImport = () => {
    setRestoreError(null);

    if (!restoreFile || !restorePreview) {
      setRestoreError("Preview the backup successfully before restoring it.");
      return;
    }

    const run = async () => {
      setImportingBackup(true);

      try {
        if (!stagedRestore) {
          const result = await importEncryptedBackup(restoreFile, restorePassphrase, {
            includeAttachments: restoreAttachments,
            includeExportBundles: restoreExportBundles,
          });

          if (result.status !== "staged") {
            throw new Error("Expected restore staging before promotion.");
          }

          setStagedRestore(result.stagedRestore);
          setRestoreWarning("Restore staged in a temporary namespace. Review the diff and confirm again to promote it into the live vault.");
          return;
        }

        const result = await importEncryptedBackup(restoreFile, restorePassphrase, {
          includeAttachments: restoreAttachments,
          includeExportBundles: restoreExportBundles,
          confirmationToken: stagedRestore.stageId,
        });

        if (result.status !== "restored") {
          throw new Error("Expected staged restore promotion to complete.");
        }

        setRestoreWarning(
          `Vault restored (${result.cases} cases, ${result.evidenceItems} evidence items, ${result.attachments} attachments, ${result.exportBundles} export bundles). Rollback snapshot ${result.rollbackSnapshotId} was captured automatically. The vault is now locked; unlock with the restored vault passphrase.`
        );
        setRestorePreview(null);
        setStagedRestore(null);
      } catch (error) {
        setRestoreError(error instanceof Error ? error.message : "Unable to import encrypted backup.");
      } finally {
        setImportingBackup(false);
      }
    };

    void run();
  };

  return (
    <form onSubmit={handleBackupPreview} className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/80 p-4">
      <div>
        <h4 className="text-sm font-semibold text-zinc-100">Restore encrypted backup</h4>
        <p className="mt-1 text-xs text-zinc-400">
          Stages the backup locally, shows the diff, then requires a second confirmation before promotion.
        </p>
      </div>

      <label className="block text-sm text-zinc-200">
        <span className="mb-1 block">Backup file</span>
        <input
          type="file"
          accept=".pvault,application/json"
          onChange={(event) => {
            setRestoreFile(event.target.files?.[0] ?? null);
            clearRestoreState();
          }}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-200"
          required
        />
      </label>

      <label className="block text-sm text-zinc-200">
        <span className="mb-1 block">Backup passphrase</span>
        <input
          type="password"
          value={restorePassphrase}
          onChange={(event) => {
            setRestorePassphrase(event.target.value);
            clearRestoreState();
          }}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
          autoComplete="current-password"
          required
        />
      </label>

      <label className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={restoreAttachments}
          onChange={(event) => {
            setRestoreAttachments(event.target.checked);
            clearRestoreState();
          }}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
        />
        <span>Restore attachments</span>
      </label>

      <label className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={restoreExportBundles}
          onChange={(event) => {
            setRestoreExportBundles(event.target.checked);
            clearRestoreState();
          }}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
        />
        <span>Restore export history</span>
      </label>

      {restorePreview ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-200">
          <p className="font-semibold text-emerald-300">Preview verified</p>
          <p className="mt-1">Exported: {restorePreview.exportedAt}</p>
          <p>Created: {restorePreview.createdAt}</p>
          <p>
            Cases {restorePreview.cases} · Evidence {restorePreview.evidenceItems} · Attachments {restorePreview.attachments}
          </p>
          <p>Export bundles {restorePreview.exportBundles} · Ledger entries {restorePreview.ledger}</p>
          <p>
            Options: attachments {restorePreview.options.includeAttachments ? "included" : "skipped"} · export history {restorePreview.options.includeExportBundles ? "included" : "skipped"}
          </p>
          <p className="mt-1 break-all">Snapshot SHA-256: {restorePreview.snapshotSha256}</p>

          <div className="mt-3 rounded-md border border-emerald-500/20 bg-black/10 px-3 py-2 text-xs text-emerald-100">
            <p className="font-semibold text-emerald-200">Dry-run overwrite report</p>
            <p className="mt-1">
              Current vault: {restorePreview.current.cases} cases · {restorePreview.current.evidenceItems} evidence · {restorePreview.current.attachments} attachments
            </p>
            <ul className="mt-2 space-y-1 text-emerald-100">
              <li>
                Cases: overwrite {restorePreview.diff.cases.overlapping}, add {restorePreview.diff.cases.incomingOnly}, remove {restorePreview.diff.cases.currentOnly}
              </li>
              <li>
                Evidence: overwrite {restorePreview.diff.evidenceItems.overlapping}, add {restorePreview.diff.evidenceItems.incomingOnly}, remove {restorePreview.diff.evidenceItems.currentOnly}
              </li>
              <li>
                Attachments: {restorePreview.options.includeAttachments ? `overwrite ${restorePreview.diff.attachments.overlapping}, add ${restorePreview.diff.attachments.incomingOnly}, remove ${restorePreview.diff.attachments.currentOnly}` : "skipped"}
              </li>
              <li>
                Export bundles: {restorePreview.options.includeExportBundles ? `overwrite ${restorePreview.diff.exportBundles.overlapping}, add ${restorePreview.diff.exportBundles.incomingOnly}, remove ${restorePreview.diff.exportBundles.currentOnly}` : "skipped"}
              </li>
              <li>
                Ledger: overwrite {restorePreview.diff.ledger.overlapping}, add {restorePreview.diff.ledger.incomingOnly}, remove {restorePreview.diff.ledger.currentOnly}
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {stagedRestore ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
          <p className="font-semibold text-amber-200">Restore staged</p>
          <p className="mt-1">Stage ID: {stagedRestore.stageId}</p>
          <p>Staged at: {stagedRestore.stagedAt}</p>
          <p className="mt-1 break-all">Snapshot SHA-256: {stagedRestore.snapshotSha256}</p>
          <p className="mt-2">A pre-restore rollback snapshot will be captured automatically if you confirm promotion.</p>
        </div>
      ) : null}

      {restoreError ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{restoreError}</p>
      ) : null}

      {restoreWarning ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {restoreWarning}
        </p>
      ) : null}

      <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-xs text-zinc-400">
        Restore is non-destructive by default. Preview first, then stage the backup, then confirm promotion only after checking the diff.
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={previewingBackup || importingBackup}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {previewingBackup ? "Previewing..." : "Preview Backup"}
        </button>
        <button
          type="button"
          onClick={handleBackupImport}
          disabled={importingBackup || restorePreview === null}
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importingBackup ? (stagedRestore ? "Promoting..." : "Staging...") : stagedRestore ? "Confirm Restore" : "Stage Restore"}
        </button>
      </div>
    </form>
  );
}

function RollbackSnapshotsCard() {
  const [rollbackSnapshots, setRollbackSnapshots] = useState<RollbackSnapshotSummary[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);
  const [armedRollbackId, setArmedRollbackId] = useState<string | null>(null);
  const [restoringRollbackId, setRestoringRollbackId] = useState<string | null>(null);

  const loadRollbackSnapshots = async () => {
    setLoadingSnapshots(true);

    try {
      const snapshots = await listRollbackSnapshots();
      setRollbackSnapshots(snapshots);
    } catch (error) {
      setRollbackError(error instanceof Error ? error.message : "Unable to load rollback snapshots.");
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    void loadRollbackSnapshots();
  }, []);

  const handleRollbackRestore = (snapshotId: string) => {
    setRollbackError(null);
    setRollbackMessage(null);

    if (armedRollbackId !== snapshotId) {
      setArmedRollbackId(snapshotId);
      setRollbackMessage(
        "Rollback armed. Click the same restore button again to replace the live vault from that snapshot. A fresh rollback snapshot will be captured first."
      );
      return;
    }

    const run = async () => {
      setRestoringRollbackId(snapshotId);

      try {
        const result = await restoreRollbackSnapshot(snapshotId);
        setRollbackMessage(
          `Rollback restored (${result.cases} cases, ${result.evidenceItems} evidence items, ${result.attachments} attachments, ${result.exportBundles} export bundles). Fresh rollback snapshot ${result.rollbackSnapshotId} was captured before promotion. The vault is now locked; unlock with the restored vault passphrase.`
        );
        setArmedRollbackId(null);
        await loadRollbackSnapshots();
      } catch (error) {
        setRollbackError(error instanceof Error ? error.message : "Unable to restore rollback snapshot.");
      } finally {
        setRestoringRollbackId(null);
      }
    };

    void run();
  };

  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950/80 p-4 lg:col-span-2">
      <div>
        <h4 className="text-sm font-semibold text-zinc-100">Rollback snapshots</h4>
        <p className="mt-1 text-xs text-zinc-400">
          Pre-restore checkpoints are captured locally before a staged backup or rollback snapshot is promoted into the live vault.
        </p>
      </div>

      {rollbackError ? (
        <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {rollbackError}
        </p>
      ) : null}

      {rollbackMessage ? (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {rollbackMessage}
        </p>
      ) : null}

      {loadingSnapshots ? (
        <p className="mt-3 text-xs text-zinc-400">Loading rollback snapshots...</p>
      ) : rollbackSnapshots.length === 0 ? (
        <p className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-xs text-zinc-400">
          No rollback snapshots captured yet. They appear after a restore promotion replaces the live vault.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {rollbackSnapshots.map((snapshot) => {
            const isArmed = armedRollbackId === snapshot.id;
            const isRestoring = restoringRollbackId === snapshot.id;

            return (
              <div
                key={snapshot.id}
                className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-3 text-xs text-zinc-300"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-100">Captured {snapshot.createdAt}</p>
                    <p>Source vault export timestamp: {snapshot.exportedAt}</p>
                    <p>
                      Cases {snapshot.counts.cases} · Evidence {snapshot.counts.evidenceItems} · Attachments {snapshot.counts.attachments} · Export bundles {snapshot.counts.exportBundles}
                    </p>
                    <p className="break-all text-zinc-500">Snapshot SHA-256: {snapshot.snapshotSha256}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRollbackRestore(snapshot.id)}
                    disabled={restoringRollbackId !== null}
                    className={`rounded-md px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                      isArmed
                        ? "border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        : "border border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    {isRestoring ? "Restoring..." : isArmed ? "Confirm Rollback" : "Arm Rollback"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function Security() {
  const {
    idleTimeoutMinutes,
    lock,
    lockOnHidden,
    rotatePassphrase,
    setIdleTimeoutMinutes,
    setLockOnHidden,
  } = useAppLock();

  return (
    <section>
      <SectionHeader
        title="Security"
        subtitle="Session controls, vault lock policy, and passphrase rotation"
        rightSlot={
          <button
            type="button"
            onClick={lock}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Lock Vault Now
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SessionBehaviorCard
          idleTimeoutMinutes={idleTimeoutMinutes}
          lockOnHidden={lockOnHidden}
          onChangeIdleTimeout={setIdleTimeoutMinutes}
          onChangeLockOnHidden={setLockOnHidden}
        />
        <RotationCard onRotatePassphrase={rotatePassphrase} />

        <section className="pv-card space-y-4 lg:col-span-2">
          <div>
            <h3 className="pv-section-title">Encrypted backup and restore</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Create a portable encrypted vault backup or restore one locally. Backup encryption is separate from the vault passphrase.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BackupExportCard />
            <BackupRestoreCard />
            <RollbackSnapshotsCard />
          </div>
        </section>
      </div>
    </section>
  );
}