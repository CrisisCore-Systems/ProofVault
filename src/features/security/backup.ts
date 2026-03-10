import type { AttachmentRecord, CaseFile, EvidenceItem, ExportBundle, LedgerEntry } from "../../domain/types";
import { db } from "../../db/index";
import { sha256HexFromText } from "../../lib/hashing/sha256";
import { downloadBlobFile } from "../../lib/utils/download";
import {
  type StoredSecurityConfig,
  getStoredSecurityConfigForBackup,
  restoreSecurityConfigFromBackup,
} from "./session";
import { createRandomBase64, decryptJson, deriveAesKeyFromPassphrase, encryptJson } from "./crypto";

type SerializedAttachmentRecord = Omit<AttachmentRecord, "blob"> & {
  blobBase64: string;
};

type VaultBackupSnapshot = {
  format: "proofvault-backup";
  version: 1;
  exportedAt: string;
  securityConfig: StoredSecurityConfig;
  tables: {
    cases: CaseFile[];
    evidenceItems: EvidenceItem[];
    exportBundles: ExportBundle[];
    attachments: SerializedAttachmentRecord[];
    ledger: LedgerEntry[];
  };
};

type EncryptedVaultBackup = {
  format: "proofvault-encrypted-backup";
  version: 1;
  createdAt: string;
  salt: string;
  snapshotSha256: string;
  summary: {
    exportedAt: string;
    cases: number;
    evidenceItems: number;
    exportBundles: number;
    attachments: number;
    ledger: number;
  };
  payload: {
    version: 1;
    algorithm: "AES-GCM";
    iv: string;
    ciphertext: string;
  };
};

export type VaultBackupPreview = {
  createdAt: string;
  exportedAt: string;
  cases: number;
  evidenceItems: number;
  exportBundles: number;
  attachments: number;
  ledger: number;
  snapshotSha256: string;
  current: {
    cases: number;
    evidenceItems: number;
    exportBundles: number;
    attachments: number;
    ledger: number;
  };
  conflicts: {
    cases: { overlapping: number; incomingOnly: number };
    evidenceItems: { overlapping: number; incomingOnly: number };
    exportBundles: { overlapping: number; incomingOnly: number };
    attachments: { overlapping: number; incomingOnly: number };
    ledger: { overlapping: number; incomingOnly: number };
  };
  options: {
    includeAttachments: boolean;
    includeExportBundles: boolean;
  };
};

export type VaultRestoreOptions = {
  includeAttachments: boolean;
  includeExportBundles: boolean;
};

const DEFAULT_RESTORE_OPTIONS: VaultRestoreOptions = {
  includeAttachments: true,
  includeExportBundles: true,
};

function normalizeRestoreOptions(options?: Partial<VaultRestoreOptions>): VaultRestoreOptions {
  return {
    includeAttachments: options?.includeAttachments ?? DEFAULT_RESTORE_OPTIONS.includeAttachments,
    includeExportBundles: options?.includeExportBundles ?? DEFAULT_RESTORE_OPTIONS.includeExportBundles,
  };
}

function compareIds(incomingIds: string[], currentIds: string[]): { overlapping: number; incomingOnly: number } {
  const currentSet = new Set(currentIds);

  let overlapping = 0;
  let incomingOnly = 0;

  incomingIds.forEach((id) => {
    if (currentSet.has(id)) {
      overlapping += 1;
      return;
    }

    incomingOnly += 1;
  });

  return { overlapping, incomingOnly };
}

function validateBackupPassphrase(passphrase: string) {
  if (passphrase.trim().length < 10) {
    throw new Error("Backup passphrase must be at least 10 characters.");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((value) => {
    binary += String.fromCodePoint(value);
  });

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }

  return bytes;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

function base64ToBlob(value: string, mimeType: string): Blob {
  const bytes = base64ToBytes(value);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: mimeType || "application/octet-stream" });
}

async function readBackupFile(file: File): Promise<EncryptedVaultBackup> {
  const content = await file.text();

  try {
    return JSON.parse(content) as EncryptedVaultBackup;
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }
}

function assertBackupEnvelope(value: EncryptedVaultBackup): EncryptedVaultBackup {
  if (
    value.format !== "proofvault-encrypted-backup" ||
    value.version !== 1 ||
    !value.salt ||
    !value.payload ||
    !value.snapshotSha256 ||
    !value.summary
  ) {
    throw new Error("Unsupported backup file format.");
  }

  return value;
}

function assertBackupSnapshot(value: VaultBackupSnapshot): VaultBackupSnapshot {
  if (value.format !== "proofvault-backup" || value.version !== 1) {
    throw new Error("Unsupported decrypted backup payload.");
  }

  return value;
}

async function decryptVerifiedSnapshot(file: File, backupPassphrase: string): Promise<{
  envelope: EncryptedVaultBackup;
  snapshot: VaultBackupSnapshot;
}> {
  validateBackupPassphrase(backupPassphrase);

  const envelope = assertBackupEnvelope(await readBackupFile(file));
  const key = await deriveAesKeyFromPassphrase(backupPassphrase, envelope.salt);

  let snapshot: VaultBackupSnapshot;

  try {
    snapshot = assertBackupSnapshot(await decryptJson<VaultBackupSnapshot>(envelope.payload, key));
  } catch {
    throw new Error("Backup passphrase is incorrect or the backup file is corrupted.");
  }

  const snapshotSha256 = await sha256HexFromText(JSON.stringify(snapshot));

  if (snapshotSha256 !== envelope.snapshotSha256) {
    throw new Error("Backup integrity check failed. The decrypted snapshot hash does not match the backup envelope.");
  }

  return { envelope, snapshot };
}

export async function previewEncryptedBackup(
  file: File,
  backupPassphrase: string,
  options?: Partial<VaultRestoreOptions>
): Promise<VaultBackupPreview> {
  const { envelope, snapshot } = await decryptVerifiedSnapshot(file, backupPassphrase);
  const normalizedOptions = normalizeRestoreOptions(options);
  const [currentCases, currentEvidenceItems, currentExportBundles, currentAttachments, currentLedger] = await Promise.all([
    db.cases.toArray(),
    db.evidenceItems.toArray(),
    db.exportBundles.toArray(),
    db.attachments.toArray(),
    db.ledger.toArray(),
  ]);

  return {
    createdAt: envelope.createdAt,
    exportedAt: snapshot.exportedAt,
    cases: snapshot.tables.cases.length,
    evidenceItems: snapshot.tables.evidenceItems.length,
    exportBundles: snapshot.tables.exportBundles.length,
    attachments: snapshot.tables.attachments.length,
    ledger: snapshot.tables.ledger.length,
    snapshotSha256: envelope.snapshotSha256,
    current: {
      cases: currentCases.length,
      evidenceItems: currentEvidenceItems.length,
      exportBundles: currentExportBundles.length,
      attachments: currentAttachments.length,
      ledger: currentLedger.length,
    },
    conflicts: {
      cases: compareIds(
        snapshot.tables.cases.map((item) => item.id),
        currentCases.map((item) => item.id)
      ),
      evidenceItems: compareIds(
        snapshot.tables.evidenceItems.map((item) => item.id),
        currentEvidenceItems.map((item) => item.id)
      ),
      exportBundles: normalizedOptions.includeExportBundles
        ? compareIds(
            snapshot.tables.exportBundles.map((item) => item.id),
            currentExportBundles.map((item) => item.id)
          )
        : { overlapping: 0, incomingOnly: 0 },
      attachments: normalizedOptions.includeAttachments
        ? compareIds(
            snapshot.tables.attachments.map((item) => item.id),
            currentAttachments.map((item) => item.id)
          )
        : { overlapping: 0, incomingOnly: 0 },
      ledger: compareIds(
        snapshot.tables.ledger.map((item) => item.id),
        currentLedger.map((item) => item.id)
      ),
    },
    options: normalizedOptions,
  };
}

export async function exportEncryptedBackup(backupPassphrase: string): Promise<void> {
  validateBackupPassphrase(backupPassphrase);

  const [cases, evidenceItems, exportBundles, attachments, ledger] = await Promise.all([
    db.cases.toArray(),
    db.evidenceItems.toArray(),
    db.exportBundles.toArray(),
    db.attachments.toArray(),
    db.ledger.toArray(),
  ]);

  const serializedAttachments = await Promise.all(
    attachments.map(async (attachment) => ({
      id: attachment.id,
      evidenceItemId: attachment.evidenceItemId,
      blobBase64: await blobToBase64(attachment.blob),
      sizeBytes: attachment.sizeBytes,
      mimeType: attachment.mimeType,
      originalFilename: attachment.originalFilename,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
    }))
  );

  const snapshot: VaultBackupSnapshot = {
    format: "proofvault-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    securityConfig: getStoredSecurityConfigForBackup(),
    tables: {
      cases,
      evidenceItems,
      exportBundles,
      attachments: serializedAttachments,
      ledger,
    },
  };

  const snapshotSha256 = await sha256HexFromText(JSON.stringify(snapshot));

  const salt = createRandomBase64(16);
  const key = await deriveAesKeyFromPassphrase(backupPassphrase, salt);
  const payload = await encryptJson(snapshot, key);

  const envelope: EncryptedVaultBackup = {
    format: "proofvault-encrypted-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    salt,
    snapshotSha256,
    summary: {
      exportedAt: snapshot.exportedAt,
      cases: snapshot.tables.cases.length,
      evidenceItems: snapshot.tables.evidenceItems.length,
      exportBundles: snapshot.tables.exportBundles.length,
      attachments: snapshot.tables.attachments.length,
      ledger: snapshot.tables.ledger.length,
    },
    payload,
  };

  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const fileStamp = new Date().toISOString().slice(0, 10);

  downloadBlobFile(`proofvault-backup-${fileStamp}.pvault`, blob);
}

export async function importEncryptedBackup(
  file: File,
  backupPassphrase: string,
  options?: Partial<VaultRestoreOptions>
): Promise<{
  cases: number;
  evidenceItems: number;
  attachments: number;
  exportBundles: number;
}> {
  const normalizedOptions = normalizeRestoreOptions(options);
  const { snapshot } = await decryptVerifiedSnapshot(file, backupPassphrase);

  const restoredAttachments: AttachmentRecord[] = normalizedOptions.includeAttachments
    ? snapshot.tables.attachments.map((attachment) => ({
        id: attachment.id,
        evidenceItemId: attachment.evidenceItemId,
        blob: base64ToBlob(attachment.blobBase64, attachment.mimeType),
        sizeBytes: attachment.sizeBytes,
        mimeType: attachment.mimeType,
        originalFilename: attachment.originalFilename,
        createdAt: attachment.createdAt,
        updatedAt: attachment.updatedAt,
      }))
    : [];

  await db.transaction(
    "rw",
    [db.cases, db.evidenceItems, db.exportBundles, db.attachments, db.ledger],
    async () => {
      await Promise.all([
        db.cases.clear(),
        db.evidenceItems.clear(),
        db.exportBundles.clear(),
        db.attachments.clear(),
        db.ledger.clear(),
      ]);

      if (snapshot.tables.cases.length > 0) {
        await db.cases.bulkPut(snapshot.tables.cases);
      }

      if (snapshot.tables.evidenceItems.length > 0) {
        await db.evidenceItems.bulkPut(snapshot.tables.evidenceItems);
      }

      if (normalizedOptions.includeExportBundles && snapshot.tables.exportBundles.length > 0) {
        await db.exportBundles.bulkPut(snapshot.tables.exportBundles);
      }

      if (normalizedOptions.includeAttachments && restoredAttachments.length > 0) {
        await db.attachments.bulkPut(restoredAttachments);
      }

      if (snapshot.tables.ledger.length > 0) {
        await db.ledger.bulkPut(snapshot.tables.ledger);
      }
    }
  );

  restoreSecurityConfigFromBackup(snapshot.securityConfig);

  return {
    cases: snapshot.tables.cases.length,
    evidenceItems: snapshot.tables.evidenceItems.length,
    attachments: restoredAttachments.length,
    exportBundles: normalizedOptions.includeExportBundles ? snapshot.tables.exportBundles.length : 0,
  };
}