import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttachmentRecord, CaseFile, EvidenceItem, ExportBundle, LedgerEntry } from "../../domain/types";

type MockTable<T> = {
  toArray: ReturnType<typeof vi.fn<() => Promise<T[]>>>;
  clear: ReturnType<typeof vi.fn<() => Promise<void>>>;
  bulkPut: ReturnType<typeof vi.fn<(items: T[]) => Promise<void>>>;
};

const {
  mockDb,
  mockVaultState,
  downloadBlobFileMock,
  getStoredSecurityConfigForBackupMock,
  restoreSecurityConfigFromBackupMock,
  deriveVerifiedKeyFromConfigMock,
} = vi.hoisted(() => {
  const state = {
    cases: [] as CaseFile[],
    evidenceItems: [] as EvidenceItem[],
    exportBundles: [] as ExportBundle[],
    attachments: [] as AttachmentRecord[],
    ledger: [] as LedgerEntry[],
  };

  const createTable = <T extends { id: string }>(key: keyof typeof state) => ({
    toArray: vi.fn(async () => [...((state[key] as unknown) as T[])]),
    clear: vi.fn(async () => {
      state[key] = [] as never;
    }),
    bulkPut: vi.fn(async (items: T[]) => {
      state[key] = [...items] as never;
    }),
  });

  return {
    mockVaultState: state,
    mockDb: {
      cases: createTable<CaseFile>("cases"),
      evidenceItems: createTable<EvidenceItem>("evidenceItems"),
      exportBundles: createTable<ExportBundle>("exportBundles"),
      attachments: createTable<AttachmentRecord>("attachments"),
      ledger: createTable<LedgerEntry>("ledger"),
      transaction: vi.fn(async (...args: unknown[]) => {
        const callback = args.at(-1);

        if (typeof callback === "function") {
          return callback();
        }

        return undefined;
      }),
    } satisfies {
      cases: MockTable<CaseFile>;
      evidenceItems: MockTable<EvidenceItem>;
      exportBundles: MockTable<ExportBundle>;
      attachments: MockTable<AttachmentRecord>;
      ledger: MockTable<LedgerEntry>;
      transaction: ReturnType<typeof vi.fn>;
    },
    downloadBlobFileMock: vi.fn(),
    getStoredSecurityConfigForBackupMock: vi.fn(),
    restoreSecurityConfigFromBackupMock: vi.fn(),
    deriveVerifiedKeyFromConfigMock: vi.fn(),
  };
});

vi.mock("../../db/index", () => ({
  db: mockDb,
}));

vi.mock("../../lib/utils/download", () => ({
  downloadBlobFile: downloadBlobFileMock,
}));

vi.mock("./session", () => ({
  getStoredSecurityConfigForBackup: getStoredSecurityConfigForBackupMock,
  restoreSecurityConfigFromBackup: restoreSecurityConfigFromBackupMock,
  deriveVerifiedKeyFromConfig: deriveVerifiedKeyFromConfigMock,
}));

import {
  exportEncryptedBackup,
  importEncryptedBackup,
  listRollbackSnapshots,
  previewEncryptedBackup,
  restoreRollbackSnapshot,
} from "./backup";

function seedMockVaultState(input: {
  cases?: CaseFile[];
  evidenceItems?: EvidenceItem[];
  exportBundles?: ExportBundle[];
  attachments?: AttachmentRecord[];
  ledger?: LedgerEntry[];
}) {
  mockVaultState.cases = [...(input.cases ?? [])];
  mockVaultState.evidenceItems = [...(input.evidenceItems ?? [])];
  mockVaultState.exportBundles = [...(input.exportBundles ?? [])];
  mockVaultState.attachments = [...(input.attachments ?? [])];
  mockVaultState.ledger = [...(input.ledger ?? [])];
}

describe("backup staged restore flow", () => {
  beforeEach(() => {
    seedMockVaultState({});
    downloadBlobFileMock.mockReset();
    restoreSecurityConfigFromBackupMock.mockReset();
    deriveVerifiedKeyFromConfigMock.mockReset();
    getStoredSecurityConfigForBackupMock.mockReturnValue({
      version: 1,
      salt: "c2FsdC1maXh0dXJl",
      verifier: {
        version: 1,
        algorithm: "AES-GCM",
        iv: "aXYtZml4dHVyZQ==",
        ciphertext: "Y2lwaGVydGV4dC1maXh0dXJl",
      },
      preferences: {
        idleTimeoutMinutes: 10,
        lockOnHidden: true,
      },
    });
  });

  it("previews, stages, promotes, and rolls back a backup restore", async () => {
    const backupCase: CaseFile = {
      id: "case-backup-1",
      title: "Backup case",
      type: "housing",
      status: "active",
      createdAt: "2026-03-01T08:00:00.000Z",
      updatedAt: "2026-03-01T09:00:00.000Z",
    };
    const backupEvidence: EvidenceItem = {
      id: "ev-backup-1",
      caseId: backupCase.id,
      kind: "note",
      title: "Backup note",
      description: "Restored note",
      recordedAt: "2026-03-01T09:10:00.000Z",
      includeInExport: true,
      redactionStatus: "none",
      dateCertainty: "exact",
      createdAt: "2026-03-01T09:10:00.000Z",
      updatedAt: "2026-03-01T09:10:00.000Z",
    };
    const backupAttachment: AttachmentRecord = {
      id: "att-backup-1",
      evidenceItemId: backupEvidence.id,
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "application/pdf" }),
      sizeBytes: 4,
      mimeType: "application/pdf",
      originalFilename: "backup.pdf",
      createdAt: "2026-03-01T09:15:00.000Z",
      updatedAt: "2026-03-01T09:15:00.000Z",
      encrypted: true,
      encryptionIv: new Uint8Array([9, 8, 7, 6]),
    };
    const backupBundle: ExportBundle = {
      id: "bundle-backup-1",
      caseId: backupCase.id,
      mode: "redacted",
      createdAt: "2026-03-01T09:20:00.000Z",
      itemIds: [backupEvidence.id],
      manifestRef: "manifest-backup.json",
      archiveRef: "archive-backup.zip",
    };
    const backupLedger: LedgerEntry = {
      id: "ledger-backup-1",
      timestamp: "2026-03-01T09:25:00.000Z",
      event: "backup.created",
      caseId: backupCase.id,
      hash: "a".repeat(64),
    };

    seedMockVaultState({
      cases: [backupCase],
      evidenceItems: [backupEvidence],
      exportBundles: [backupBundle],
      attachments: [backupAttachment],
      ledger: [backupLedger],
    });

    const backupPassphrase = "backup-passphrase-ridge-echo-42";

    await exportEncryptedBackup(backupPassphrase);

    expect(downloadBlobFileMock).toHaveBeenCalledTimes(1);

    const [backupFileName, backupBlob] = downloadBlobFileMock.mock.calls[0]!;
    const backupFile = new File([backupBlob], backupFileName, {
      type: "application/json",
      lastModified: Date.parse("2026-03-02T10:00:00.000Z"),
    });

    const liveCase: CaseFile = {
      id: "case-live-1",
      title: "Live case",
      type: "other",
      status: "active",
      createdAt: "2026-03-02T08:00:00.000Z",
      updatedAt: "2026-03-02T09:00:00.000Z",
    };
    const liveEvidence: EvidenceItem = {
      id: "ev-live-1",
      caseId: liveCase.id,
      kind: "note",
      title: "Live note",
      description: "Current local note",
      recordedAt: "2026-03-02T09:10:00.000Z",
      includeInExport: true,
      redactionStatus: "none",
      dateCertainty: "exact",
      createdAt: "2026-03-02T09:10:00.000Z",
      updatedAt: "2026-03-02T09:10:00.000Z",
    };
    const liveLedger: LedgerEntry = {
      id: "ledger-live-1",
      timestamp: "2026-03-02T09:25:00.000Z",
      event: "live.created",
      caseId: liveCase.id,
      hash: "b".repeat(64),
    };

    seedMockVaultState({
      cases: [liveCase],
      evidenceItems: [liveEvidence],
      exportBundles: [],
      attachments: [],
      ledger: [liveLedger],
    });

    const preview = await previewEncryptedBackup(backupFile, backupPassphrase, {
      includeAttachments: true,
      includeExportBundles: true,
    });

    expect(preview.current.cases).toBe(1);
    expect(preview.diff.cases.incomingOnly).toBe(1);
    expect(preview.diff.cases.currentOnly).toBe(1);
    expect(preview.diff.attachments.incomingOnly).toBe(1);
    expect(preview.diff.exportBundles.incomingOnly).toBe(1);

    const stagedResult = await importEncryptedBackup(backupFile, backupPassphrase, {
      includeAttachments: true,
      includeExportBundles: true,
    });

    expect(stagedResult.status).toBe("staged");

    if (stagedResult.status !== "staged") {
      throw new Error("Expected restore staging to complete before promotion.");
    }

    expect(mockVaultState.cases.map((item) => item.id)).toEqual([liveCase.id]);

    const promotedResult = await importEncryptedBackup(backupFile, backupPassphrase, {
      includeAttachments: true,
      includeExportBundles: true,
      confirmationToken: stagedResult.stagedRestore.stageId,
    });

    expect(promotedResult.status).toBe("restored");

    if (promotedResult.status !== "restored") {
      throw new Error("Expected staged restore confirmation to promote the backup.");
    }

    expect(restoreSecurityConfigFromBackupMock).toHaveBeenCalledTimes(1);
    expect(mockVaultState.cases.map((item) => item.id)).toEqual([backupCase.id]);
    expect(mockVaultState.evidenceItems.map((item) => item.id)).toEqual([backupEvidence.id]);
    expect(mockVaultState.attachments.map((item) => item.id)).toEqual([backupAttachment.id]);
    expect(mockVaultState.exportBundles.map((item) => item.id)).toEqual([backupBundle.id]);

    const rollbackSnapshots = await listRollbackSnapshots();

    expect(rollbackSnapshots).toHaveLength(1);
    expect(rollbackSnapshots[0]).toMatchObject({
      id: promotedResult.rollbackSnapshotId,
      counts: {
        cases: 1,
        evidenceItems: 1,
        exportBundles: 0,
        attachments: 0,
        ledger: 1,
      },
    });

    const rollbackResult = await restoreRollbackSnapshot(promotedResult.rollbackSnapshotId);

    expect(rollbackResult.status).toBe("restored");
    expect(mockVaultState.cases.map((item) => item.id)).toEqual([liveCase.id]);
    expect(mockVaultState.evidenceItems.map((item) => item.id)).toEqual([liveEvidence.id]);
    expect(mockVaultState.attachments).toHaveLength(0);
    expect(mockVaultState.exportBundles).toHaveLength(0);

    const rollbackSnapshotsAfterRollback = await listRollbackSnapshots();
    expect(rollbackSnapshotsAfterRollback).toHaveLength(2);
  });
});