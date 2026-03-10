import { useState, type ComponentProps } from "react";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useAppLock } from "../../features/security/AppLock";
import {
  exportEncryptedBackup,
  importEncryptedBackup,
  previewEncryptedBackup,
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
        <p>Write the new passphrase down securely before applying it.</p>
        <p className="mt-1">There is no recovery path if the passphrase is lost.</p>
      </div>
    </section>
  );
}

function BackupExportCard() {
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
  const [previewingBackup, setPreviewingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);

  const clearRestoreState = () => {
    setRestoreError(null);
    setRestoreWarning(null);
    setRestorePreview(null);
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
        setRestoreWarning("Backup preview verified. Restoring will overwrite the current local vault.");
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
        const result = await importEncryptedBackup(restoreFile, restorePassphrase, {
          includeAttachments: restoreAttachments,
          includeExportBundles: restoreExportBundles,
        });
        setRestoreWarning(
          `Vault restored (${result.cases} cases, ${result.evidenceItems} evidence items, ${result.attachments} attachments, ${result.exportBundles} export bundles). The vault is now locked; unlock with the restored vault passphrase.`
        );
        setRestorePreview(null);
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
          Replaces the current local vault with the selected backup, then locks the app.
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
                Cases: overwrite {restorePreview.conflicts.cases.overlapping}, add {restorePreview.conflicts.cases.incomingOnly}
              </li>
              <li>
                Evidence: overwrite {restorePreview.conflicts.evidenceItems.overlapping}, add {restorePreview.conflicts.evidenceItems.incomingOnly}
              </li>
              <li>
                Attachments: {restorePreview.options.includeAttachments ? `overwrite ${restorePreview.conflicts.attachments.overlapping}, add ${restorePreview.conflicts.attachments.incomingOnly}` : "skipped"}
              </li>
              <li>
                Export bundles: {restorePreview.options.includeExportBundles ? `overwrite ${restorePreview.conflicts.exportBundles.overlapping}, add ${restorePreview.conflicts.exportBundles.incomingOnly}` : "skipped"}
              </li>
              <li>
                Ledger: overwrite {restorePreview.conflicts.ledger.overlapping}, add {restorePreview.conflicts.ledger.incomingOnly}
              </li>
            </ul>
          </div>
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
        Import overwrites the current local vault contents on this device. Preview first to verify record counts and integrity.
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
          {importingBackup ? "Restoring..." : "Restore Backup"}
        </button>
      </div>
    </form>
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
          </div>
        </section>
      </div>
    </section>
  );
}