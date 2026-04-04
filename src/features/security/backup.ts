import Dexie, { type Table } from "dexie";
import type { AttachmentRecord, CaseFile, EvidenceItem, ExportBundle, LedgerEntry } from "../../domain/types";
import { db } from "../../db/index";
import { sha256HexFromText } from "../../lib/hashing/sha256";
import { downloadBlobFile } from "../../lib/utils/download";
import {
  type SecurityConfig,
  deriveVerifiedKeyFromConfig,
  getStoredSecurityConfigForBackup,
  restoreSecurityConfigFromBackup,
} from "./session";
import { createRandomBase64, decryptJson, deriveAesKeyFromPassphrase, encryptJson } from "./crypto";
import { validatePassphrasePolicy } from "./passphrasePolicy";
import { decryptCaseFileFromStorageWithKey, decryptEvidenceItemFromStorageWithKey } from "./storage";

export type SerializedAttachmentRecord = Omit<AttachmentRecord, "blob" | "encryptionIv"> & {
  blobBase64: string;
  encryptionIvBase64?: string;
};

type VaultBackupSnapshot = {
  format: "proofvault-backup";
  version: 1;
  exportedAt: string;
  securityConfig: SecurityConfig;
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

type VaultCounts = {
  cases: number;
  evidenceItems: number;
  exportBundles: number;
  attachments: number;
  ledger: number;
};

type VaultDiffBucket = {
  overlapping: number;
  incomingOnly: number;
  currentOnly: number;
};

type VaultRestoreDiff = {
  cases: VaultDiffBucket;
  evidenceItems: VaultDiffBucket;
  exportBundles: VaultDiffBucket;
  attachments: VaultDiffBucket;
  ledger: VaultDiffBucket;
};

type StagedRestoreMeta = {
  id: "active";
  stageId: string;
  stagedAt: string;
  snapshotSha256: string;
  exportedAt: string;
  options: VaultRestoreOptions;
  securityConfig: SecurityConfig;
};

type RollbackSnapshotRecord = {
  id: string;
  createdAt: string;
  reason: "pre-restore";
  snapshotSha256: string;
  snapshot: VaultBackupSnapshot;
};

class ProofVaultRestoreScratchDB extends Dexie {
  stagedCases!: Table<CaseFile, string>;
  stagedEvidenceItems!: Table<EvidenceItem, string>;
  stagedExportBundles!: Table<ExportBundle, string>;
  stagedAttachments!: Table<AttachmentRecord, string>;
  stagedLedger!: Table<LedgerEntry, string>;
  stagedMeta!: Table<StagedRestoreMeta, string>;
  rollbackSnapshots!: Table<RollbackSnapshotRecord, string>;

  constructor() {
    super("proofvault-restore-scratch");

    this.version(1).stores({
      stagedCases: "id, status, type, updatedAt, lastVerifiedAt",
      stagedEvidenceItems: "id, caseId, kind, recordedAt, occurredAt, includeInExport, updatedAt, fileRef",
      stagedExportBundles: "id, caseId, mode, createdAt",
      stagedAttachments: "id, evidenceItemId, createdAt, mimeType",
      stagedLedger: "id, timestamp, event, caseId, attachmentId",
      stagedMeta: "id, stageId, stagedAt, snapshotSha256",
      rollbackSnapshots: "id, createdAt, snapshotSha256",
    });
  }
}

type ScratchTable<T extends { id: string }> = {
  toArray: () => Promise<T[]>;
  bulkPut: (items: T[]) => Promise<void>;
  clear: () => Promise<void>;
  get: (id: string) => Promise<T | undefined>;
  put: (item: T) => Promise<string>;
};

type RestoreScratchStore = {
  stagedCases: ScratchTable<CaseFile>;
  stagedEvidenceItems: ScratchTable<EvidenceItem>;
  stagedExportBundles: ScratchTable<ExportBundle>;
  stagedAttachments: ScratchTable<AttachmentRecord>;
  stagedLedger: ScratchTable<LedgerEntry>;
  stagedMeta: ScratchTable<StagedRestoreMeta>;
  rollbackSnapshots: ScratchTable<RollbackSnapshotRecord>;
  transaction: (
    mode: "rw",
    tables: unknown[],
    scope: () => Promise<void>
  ) => Promise<void>;
};

function createInMemoryScratchTable<T extends { id: string }>(): ScratchTable<T> {
  const state = new Map<string, T>();

  return {
    async toArray() {
      return [...state.values()];
    },
    async bulkPut(items: T[]) {
      items.forEach((item) => {
        state.set(item.id, item);
      });
    },
    async clear() {
      state.clear();
    },
    async get(id: string) {
      return state.get(id);
    },
    async put(item: T) {
      state.set(item.id, item);
      return item.id;
    },
  };
}

function createRestoreScratchStore(): RestoreScratchStore {
  if (typeof globalThis.indexedDB !== "undefined") {
    return new ProofVaultRestoreScratchDB() as unknown as RestoreScratchStore;
  }

  return {
    stagedCases: createInMemoryScratchTable<CaseFile>(),
    stagedEvidenceItems: createInMemoryScratchTable<EvidenceItem>(),
    stagedExportBundles: createInMemoryScratchTable<ExportBundle>(),
    stagedAttachments: createInMemoryScratchTable<AttachmentRecord>(),
    stagedLedger: createInMemoryScratchTable<LedgerEntry>(),
    stagedMeta: createInMemoryScratchTable<StagedRestoreMeta>(),
    rollbackSnapshots: createInMemoryScratchTable<RollbackSnapshotRecord>(),
    async transaction(_mode, _tables, scope) {
      await scope();
    },
  };
}

const restoreScratchDb = createRestoreScratchStore();

export type VaultBackupPreview = {
  createdAt: string;
  exportedAt: string;
  cases: number;
  evidenceItems: number;
  exportBundles: number;
  attachments: number;
  ledger: number;
  snapshotSha256: string;
  current: VaultCounts;
  diff: VaultRestoreDiff;
  options: VaultRestoreOptions;
};

export type StagedVaultRestore = {
  stageId: string;
  stagedAt: string;
  snapshotSha256: string;
  exportedAt: string;
  current: VaultCounts;
  incoming: VaultCounts;
  diff: VaultRestoreDiff;
  options: VaultRestoreOptions;
};

export type RollbackSnapshotSummary = {
  id: string;
  createdAt: string;
  reason: "pre-restore";
  snapshotSha256: string;
  exportedAt: string;
  counts: VaultCounts;
};

export type VaultImportStageResult = {
  status: "staged";
  stagedRestore: StagedVaultRestore;
};

export type VaultImportAppliedResult = {
  status: "restored";
  cases: number;
  evidenceItems: number;
  attachments: number;
  exportBundles: number;
  rollbackSnapshotId: string;
};

export type VaultImportResult = VaultImportStageResult | VaultImportAppliedResult;

export type BackupVerificationSnapshot = {
  snapshotSha256: string;
  exportedAt: string;
  cases: CaseFile[];
  evidenceItems: EvidenceItem[];
  exportBundles: ExportBundle[];
  attachments: Array<Omit<AttachmentRecord, "blob">>;
  ledger: LedgerEntry[];
};

export type VaultRestoreOptions = {
  includeAttachments: boolean;
  includeExportBundles: boolean;
  confirmationToken?: string;
};

const DEFAULT_RESTORE_OPTIONS: VaultRestoreOptions = {
  includeAttachments: true,
  includeExportBundles: true,
};

function normalizeRestoreOptions(options?: Partial<VaultRestoreOptions>): VaultRestoreOptions {
  return {
    includeAttachments: options?.includeAttachments ?? DEFAULT_RESTORE_OPTIONS.includeAttachments,
    includeExportBundles: options?.includeExportBundles ?? DEFAULT_RESTORE_OPTIONS.includeExportBundles,
    confirmationToken: options?.confirmationToken,
  };
}

function compareIds(incomingIds: string[], currentIds: string[]): VaultDiffBucket {
  const currentSet = new Set(currentIds);
  const incomingSet = new Set(incomingIds);

  let overlapping = 0;
  let incomingOnly = 0;
  let currentOnly = 0;

  incomingIds.forEach((id) => {
    if (currentSet.has(id)) {
      overlapping += 1;
      return;
    }

    incomingOnly += 1;
  });

  currentIds.forEach((id) => {
    if (!incomingSet.has(id)) {
      currentOnly += 1;
    }
  });

  return { overlapping, incomingOnly, currentOnly };
}

function validateBackupPassphrase(passphrase: string) {
  validatePassphrasePolicy(passphrase, "backup");
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

export async function serializeAttachmentForBackup(attachment: AttachmentRecord): Promise<SerializedAttachmentRecord> {
  return {
    id: attachment.id,
    evidenceItemId: attachment.evidenceItemId,
    blobBase64: bytesToBase64(new Uint8Array(await attachment.blob.arrayBuffer())),
    sizeBytes: attachment.sizeBytes,
    mimeType: attachment.mimeType,
    originalFilename: attachment.originalFilename,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
    encrypted: attachment.encrypted,
    encryptionIvBase64: attachment.encryptionIv ? bytesToBase64(attachment.encryptionIv) : undefined,
  };
}

export function deserializeAttachmentFromBackup(serialized: SerializedAttachmentRecord): AttachmentRecord {
  const bytes = base64ToBytes(serialized.blobBase64);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  return {
    id: serialized.id,
    evidenceItemId: serialized.evidenceItemId,
    blob: new Blob([buffer], { type: serialized.mimeType || "application/octet-stream" }),
    sizeBytes: serialized.sizeBytes,
    mimeType: serialized.mimeType,
    originalFilename: serialized.originalFilename,
    createdAt: serialized.createdAt,
    updatedAt: serialized.updatedAt,
    encrypted: serialized.encrypted,
    encryptionIv: serialized.encryptionIvBase64 ? base64ToBytes(serialized.encryptionIvBase64) : undefined,
  };
}

async function serializeAttachments(attachments: AttachmentRecord[]): Promise<SerializedAttachmentRecord[]> {
  return Promise.all(
    attachments.map(async (attachment) => ({
      id: attachment.id,
      evidenceItemId: attachment.evidenceItemId,
      blobBase64: await blobToBase64(attachment.blob),
      sizeBytes: attachment.sizeBytes,
      mimeType: attachment.mimeType,
      originalFilename: attachment.originalFilename,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
      encrypted: attachment.encrypted,
      encryptionIvBase64: attachment.encryptionIv ? bytesToBase64(attachment.encryptionIv) : undefined,
    }))
  );
}

async function buildVaultBackupSnapshot(input?: {
  cases?: CaseFile[];
  evidenceItems?: EvidenceItem[];
  exportBundles?: ExportBundle[];
  attachments?: AttachmentRecord[];
  ledger?: LedgerEntry[];
  securityConfig?: SecurityConfig;
  exportedAt?: string;
}): Promise<VaultBackupSnapshot> {
  const [cases, evidenceItems, exportBundles, attachments, ledger] = await Promise.all([
    input?.cases ? Promise.resolve(input.cases) : db.cases.toArray(),
    input?.evidenceItems ? Promise.resolve(input.evidenceItems) : db.evidenceItems.toArray(),
    input?.exportBundles ? Promise.resolve(input.exportBundles) : db.exportBundles.toArray(),
    input?.attachments ? Promise.resolve(input.attachments) : db.attachments.toArray(),
    input?.ledger ? Promise.resolve(input.ledger) : db.ledger.toArray(),
  ]);

  return {
    format: "proofvault-backup",
    version: 1,
    exportedAt: input?.exportedAt ?? new Date().toISOString(),
    securityConfig: input?.securityConfig ?? getStoredSecurityConfigForBackup(),
    tables: {
      cases,
      evidenceItems,
      exportBundles,
      attachments: await serializeAttachments(attachments),
      ledger,
    },
  };
}

function deserializeAttachments(snapshot: VaultBackupSnapshot, options: VaultRestoreOptions): AttachmentRecord[] {
  if (!options.includeAttachments) {
    return [];
  }

  return snapshot.tables.attachments.map((attachment) => ({
    id: attachment.id,
    evidenceItemId: attachment.evidenceItemId,
    blob: base64ToBlob(attachment.blobBase64, attachment.mimeType),
    sizeBytes: attachment.sizeBytes,
    mimeType: attachment.mimeType,
    originalFilename: attachment.originalFilename,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
    encrypted: attachment.encrypted,
    encryptionIv: attachment.encryptionIvBase64 ? base64ToBytes(attachment.encryptionIvBase64) : undefined,
  }));
}

async function buildRestoreDiff(snapshot: VaultBackupSnapshot, options: VaultRestoreOptions): Promise<{
  current: VaultCounts;
  incoming: VaultCounts;
  diff: VaultRestoreDiff;
}> {
  const [currentCases, currentEvidenceItems, currentExportBundles, currentAttachments, currentLedger] = await Promise.all([
    db.cases.toArray(),
    db.evidenceItems.toArray(),
    db.exportBundles.toArray(),
    db.attachments.toArray(),
    db.ledger.toArray(),
  ]);
  const incomingExportBundles = options.includeExportBundles ? snapshot.tables.exportBundles : [];
  const incomingAttachments = options.includeAttachments ? snapshot.tables.attachments : [];

  return {
    current: {
      cases: currentCases.length,
      evidenceItems: currentEvidenceItems.length,
      exportBundles: currentExportBundles.length,
      attachments: currentAttachments.length,
      ledger: currentLedger.length,
    },
    incoming: {
      cases: snapshot.tables.cases.length,
      evidenceItems: snapshot.tables.evidenceItems.length,
      exportBundles: incomingExportBundles.length,
      attachments: incomingAttachments.length,
      ledger: snapshot.tables.ledger.length,
    },
    diff: {
      cases: compareIds(
        snapshot.tables.cases.map((item) => item.id),
        currentCases.map((item) => item.id)
      ),
      evidenceItems: compareIds(
        snapshot.tables.evidenceItems.map((item) => item.id),
        currentEvidenceItems.map((item) => item.id)
      ),
      exportBundles: compareIds(
        incomingExportBundles.map((item) => item.id),
        currentExportBundles.map((item) => item.id)
      ),
      attachments: compareIds(
        incomingAttachments.map((item) => item.id),
        currentAttachments.map((item) => item.id)
      ),
      ledger: compareIds(
        snapshot.tables.ledger.map((item) => item.id),
        currentLedger.map((item) => item.id)
      ),
    },
  };
}

function summarizeSnapshotCounts(snapshot: VaultBackupSnapshot): VaultCounts {
  return {
    cases: snapshot.tables.cases.length,
    evidenceItems: snapshot.tables.evidenceItems.length,
    exportBundles: snapshot.tables.exportBundles.length,
    attachments: snapshot.tables.attachments.length,
    ledger: snapshot.tables.ledger.length,
  };
}

async function clearStagedRestore(): Promise<void> {
  await restoreScratchDb.transaction(
    "rw",
    [
      restoreScratchDb.stagedCases,
      restoreScratchDb.stagedEvidenceItems,
      restoreScratchDb.stagedExportBundles,
      restoreScratchDb.stagedAttachments,
      restoreScratchDb.stagedLedger,
      restoreScratchDb.stagedMeta,
    ],
    async () => {
      await Promise.all([
        restoreScratchDb.stagedCases.clear(),
        restoreScratchDb.stagedEvidenceItems.clear(),
        restoreScratchDb.stagedExportBundles.clear(),
        restoreScratchDb.stagedAttachments.clear(),
        restoreScratchDb.stagedLedger.clear(),
        restoreScratchDb.stagedMeta.clear(),
      ]);
    }
  );
}

async function stageRestoreSnapshot(snapshot: VaultBackupSnapshot, snapshotSha256: string, options: VaultRestoreOptions) {
  const stageId = crypto.randomUUID();
  const stagedAt = new Date().toISOString();
  const restoredAttachments = deserializeAttachments(snapshot, options);

  await clearStagedRestore();

  await restoreScratchDb.transaction(
    "rw",
    [
      restoreScratchDb.stagedCases,
      restoreScratchDb.stagedEvidenceItems,
      restoreScratchDb.stagedExportBundles,
      restoreScratchDb.stagedAttachments,
      restoreScratchDb.stagedLedger,
      restoreScratchDb.stagedMeta,
    ],
    async () => {
      if (snapshot.tables.cases.length > 0) {
        await restoreScratchDb.stagedCases.bulkPut(snapshot.tables.cases);
      }

      if (snapshot.tables.evidenceItems.length > 0) {
        await restoreScratchDb.stagedEvidenceItems.bulkPut(snapshot.tables.evidenceItems);
      }

      if (options.includeExportBundles && snapshot.tables.exportBundles.length > 0) {
        await restoreScratchDb.stagedExportBundles.bulkPut(snapshot.tables.exportBundles);
      }

      if (options.includeAttachments && restoredAttachments.length > 0) {
        await restoreScratchDb.stagedAttachments.bulkPut(restoredAttachments);
      }

      if (snapshot.tables.ledger.length > 0) {
        await restoreScratchDb.stagedLedger.bulkPut(snapshot.tables.ledger);
      }

      await restoreScratchDb.stagedMeta.put({
        id: "active",
        stageId,
        stagedAt,
        snapshotSha256,
        exportedAt: snapshot.exportedAt,
        options,
        securityConfig: snapshot.securityConfig,
      });
    }
  );

  const comparison = await buildRestoreDiff(snapshot, options);

  return {
    stageId,
    stagedAt,
    snapshotSha256,
    exportedAt: snapshot.exportedAt,
    current: comparison.current,
    incoming: comparison.incoming,
    diff: comparison.diff,
    options,
  } satisfies StagedVaultRestore;
}

async function createPreRestoreSnapshot(): Promise<{ rollbackSnapshotId: string }> {
  const snapshot = await buildVaultBackupSnapshot();
  const rollbackSnapshotId = crypto.randomUUID();
  const snapshotSha256 = await sha256HexFromText(JSON.stringify(snapshot));

  await restoreScratchDb.rollbackSnapshots.put({
    id: rollbackSnapshotId,
    createdAt: new Date().toISOString(),
    reason: "pre-restore",
    snapshotSha256,
    snapshot,
  });

  return { rollbackSnapshotId };
}

async function applySnapshotToLiveVault(input: {
  snapshot: VaultBackupSnapshot;
  options: VaultRestoreOptions;
  securityConfig: SecurityConfig;
}): Promise<VaultImportAppliedResult> {
  const attachments = deserializeAttachments(input.snapshot, input.options);
  const exportBundles = input.options.includeExportBundles ? input.snapshot.tables.exportBundles : [];
  const { rollbackSnapshotId } = await createPreRestoreSnapshot();

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

      if (input.snapshot.tables.cases.length > 0) {
        await db.cases.bulkPut(input.snapshot.tables.cases);
      }

      if (input.snapshot.tables.evidenceItems.length > 0) {
        await db.evidenceItems.bulkPut(input.snapshot.tables.evidenceItems);
      }

      if (input.options.includeExportBundles && exportBundles.length > 0) {
        await db.exportBundles.bulkPut(exportBundles);
      }

      if (input.options.includeAttachments && attachments.length > 0) {
        await db.attachments.bulkPut(attachments);
      }

      if (input.snapshot.tables.ledger.length > 0) {
        await db.ledger.bulkPut(input.snapshot.tables.ledger);
      }
    }
  );

  restoreSecurityConfigFromBackup(input.securityConfig);
  await clearStagedRestore();

  return {
    status: "restored",
    cases: input.snapshot.tables.cases.length,
    evidenceItems: input.snapshot.tables.evidenceItems.length,
    attachments: input.options.includeAttachments ? attachments.length : 0,
    exportBundles: input.options.includeExportBundles ? exportBundles.length : 0,
    rollbackSnapshotId,
  };
}

async function promoteStagedRestore(expectedSnapshotSha256: string, confirmationToken: string): Promise<VaultImportAppliedResult> {
  const meta = await restoreScratchDb.stagedMeta.get("active");

  if (!meta || meta.stageId !== confirmationToken) {
    throw new Error("Restore confirmation expired. Stage the backup again before promoting it.");
  }

  if (meta.snapshotSha256 !== expectedSnapshotSha256) {
    throw new Error("Restore confirmation does not match the currently staged backup.");
  }

  const [cases, evidenceItems, exportBundles, attachments, ledger] = await Promise.all([
    restoreScratchDb.stagedCases.toArray(),
    restoreScratchDb.stagedEvidenceItems.toArray(),
    restoreScratchDb.stagedExportBundles.toArray(),
    restoreScratchDb.stagedAttachments.toArray(),
    restoreScratchDb.stagedLedger.toArray(),
  ]);

  return applySnapshotToLiveVault({
    snapshot: {
      format: "proofvault-backup",
      version: 1,
      exportedAt: meta.exportedAt,
      securityConfig: meta.securityConfig,
      tables: {
        cases,
        evidenceItems,
        exportBundles,
        attachments: await serializeAttachments(attachments),
        ledger,
      },
    },
    options: meta.options,
    securityConfig: meta.securityConfig,
  });
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

export async function readVerificationSnapshotFromBackup(
  file: File,
  backupPassphrase: string,
  vaultPassphrase: string
): Promise<BackupVerificationSnapshot> {
  const { envelope, snapshot } = await decryptVerifiedSnapshot(file, backupPassphrase);
  const vaultKey = await deriveVerifiedKeyFromConfig(vaultPassphrase, snapshot.securityConfig);

  const [cases, evidenceItems] = await Promise.all([
    Promise.all(snapshot.tables.cases.map((caseFile) => decryptCaseFileFromStorageWithKey(caseFile, vaultKey))),
    Promise.all(
      snapshot.tables.evidenceItems.map((evidenceItem) => decryptEvidenceItemFromStorageWithKey(evidenceItem, vaultKey))
    ),
  ]);

  return {
    snapshotSha256: envelope.snapshotSha256,
    exportedAt: snapshot.exportedAt,
    cases,
    evidenceItems,
    exportBundles: snapshot.tables.exportBundles,
    attachments: snapshot.tables.attachments.map((attachment) => ({
      id: attachment.id,
      evidenceItemId: attachment.evidenceItemId,
      sizeBytes: attachment.sizeBytes,
      mimeType: attachment.mimeType,
      originalFilename: attachment.originalFilename,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
    })),
    ledger: snapshot.tables.ledger,
  };
}

export async function previewEncryptedBackup(
  file: File,
  backupPassphrase: string,
  options?: Partial<VaultRestoreOptions>
): Promise<VaultBackupPreview> {
  const { envelope, snapshot } = await decryptVerifiedSnapshot(file, backupPassphrase);
  const normalizedOptions = normalizeRestoreOptions(options);
  const comparison = await buildRestoreDiff(snapshot, normalizedOptions);

  return {
    createdAt: envelope.createdAt,
    exportedAt: snapshot.exportedAt,
    cases: snapshot.tables.cases.length,
    evidenceItems: snapshot.tables.evidenceItems.length,
    exportBundles: normalizedOptions.includeExportBundles ? snapshot.tables.exportBundles.length : 0,
    attachments: normalizedOptions.includeAttachments ? snapshot.tables.attachments.length : 0,
    ledger: snapshot.tables.ledger.length,
    snapshotSha256: envelope.snapshotSha256,
    current: comparison.current,
    diff: comparison.diff,
    options: normalizedOptions,
  };
}

export async function exportEncryptedBackup(backupPassphrase: string): Promise<void> {
  validateBackupPassphrase(backupPassphrase);
  const snapshot = await buildVaultBackupSnapshot();

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
): Promise<VaultImportResult> {
  const normalizedOptions = normalizeRestoreOptions(options);
  const { envelope, snapshot } = await decryptVerifiedSnapshot(file, backupPassphrase);

  if (normalizedOptions.confirmationToken) {
    return promoteStagedRestore(envelope.snapshotSha256, normalizedOptions.confirmationToken);
  }

  const stagedRestore = await stageRestoreSnapshot(snapshot, envelope.snapshotSha256, normalizedOptions);

  return {
    status: "staged",
    stagedRestore,
  };
}

export async function listRollbackSnapshots(): Promise<RollbackSnapshotSummary[]> {
  const snapshots = await restoreScratchDb.rollbackSnapshots.toArray();

  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((snapshot) => ({
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      reason: snapshot.reason,
      snapshotSha256: snapshot.snapshotSha256,
      exportedAt: snapshot.snapshot.exportedAt,
      counts: summarizeSnapshotCounts(snapshot.snapshot),
    }));
}

export async function restoreRollbackSnapshot(rollbackSnapshotId: string): Promise<VaultImportAppliedResult> {
  const snapshot = await restoreScratchDb.rollbackSnapshots.get(rollbackSnapshotId);

  if (!snapshot) {
    throw new Error("Rollback snapshot is no longer available. Capture a new restore snapshot before retrying.");
  }

  return applySnapshotToLiveVault({
    snapshot: snapshot.snapshot,
    options: {
      includeAttachments: true,
      includeExportBundles: true,
    },
    securityConfig: snapshot.snapshot.securityConfig,
  });
}