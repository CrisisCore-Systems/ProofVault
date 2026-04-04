import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AttachmentRecord, CaseFile, EvidenceItem, ExportBundle, LedgerEntry } from "../../domain/types";
import {
  appendLedgerEntry,
  getHydratedAttachmentByEvidenceItemId,
  getLatestLedgerEntry,
  listLedgerEntries,
  upsertExportBundle,
} from "../../db/queries";
import { prepareSessionConfig, getStoredSecurityConfigForBackup } from "../../features/security/session";
import {
  exportEncryptedBackup,
  importEncryptedBackup,
  listRollbackSnapshots,
  readVerificationSnapshotFromBackup,
  restoreRollbackSnapshot,
} from "../../features/security/backup";
import {
  decryptCaseFileFromStorageWithKey,
  decryptEvidenceItemFromStorageWithKey,
  encryptCaseFileForStorageWithKey,
  encryptEvidenceItemForStorageWithKey,
} from "../../features/security/storage";
import { appendLedgerEvent } from "../../features/ledger/chain";
import { downloadBlobFile } from "../utils/download";
import { sha256HexFromBlob } from "../hashing/sha256";
import { setDisplayDateTimeMode } from "../dates/format";
import { generateClinicalVerificationCertificateHtml } from "./clinicalReportPdf";
import { generateExportPacket } from "./exportBundle";
import { shortFingerprint } from "./integrityFingerprints";
import { parseProofVaultEvidenceManifest, verifyProofVaultEvidenceManifest } from "./proofVerifier";
import { buildVerificationReport } from "./verificationReport";

type MockTable<T> = {
  toArray: ReturnType<typeof vi.fn<() => Promise<T[]>>>;
  clear: ReturnType<typeof vi.fn<() => Promise<void>>>;
  bulkPut: ReturnType<typeof vi.fn<(items: T[]) => Promise<void>>>;
};

const { mockDb, mockVaultState } = vi.hoisted(() => {
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
  };
});

vi.mock("../../db/index", () => ({
  db: mockDb,
}));

vi.mock("../../db/queries", () => ({
  getHydratedAttachmentByEvidenceItemId: vi.fn(),
  listLedgerEntries: vi.fn(),
  upsertExportBundle: vi.fn(),
  appendLedgerEntry: vi.fn(),
  getLatestLedgerEntry: vi.fn(),
}));

vi.mock("../utils/download", () => ({
  downloadBlobFile: vi.fn(),
}));

vi.mock("../../features/security/session", async () => {
  const actual = await vi.importActual<typeof import("../../features/security/session")>(
    "../../features/security/session"
  );

  return {
    ...actual,
    getStoredSecurityConfigForBackup: vi.fn(),
  };
});

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function createDeterministicRandomValues() {
  let cursor = 0;

  return (array: ArrayBufferView) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);

    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (cursor + index) % 256;
    }

    cursor += bytes.length;
  };
}

function readDownloadCall(callIndex: number): { fileName: string; blob: Blob } {
  const call = vi.mocked(downloadBlobFile).mock.calls[callIndex];

  if (!call) {
    throw new Error(`Expected download call ${callIndex} to exist.`);
  }

  return {
    fileName: call[0],
    blob: call[1],
  };
}

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

function collectArchiveFiles(archive: JSZip): string[] {
  return Object.keys(archive.files).sort((left, right) => left.localeCompare(right));
}

function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function getRepoRoot(): string {
  return process.cwd();
}

function getSpecimenOutputDir(repoRoot: string): string {
  const override = process.env.TRUST_CASE_OUTPUT_DIR?.trim();

  if (override) {
    return path.resolve(repoRoot, override);
  }

  return path.join(repoRoot, "docs", "trust-case", "demo");
}

function getGitRef(repoRoot: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unavailable";
  }
}

async function resolvePinnedGitRef(repoRoot: string): Promise<string> {
  const requestedGitRef = process.env.TRUST_CASE_GIT_REF?.trim();

  if (requestedGitRef) {
    return requestedGitRef;
  }

  try {
    const expectationText = await readFile(
      path.join(repoRoot, "docs", "trust-case", "demo", "EXPECTED_OUTPUTS.json"),
      "utf8"
    );
    const parsed = JSON.parse(expectationText) as {
      build?: {
        gitRef?: unknown;
      };
    };

    if (typeof parsed.build?.gitRef === "string" && parsed.build.gitRef.trim().length > 0) {
      return parsed.build.gitRef;
    }
  } catch {
    // Fall back to the current HEAD during initial specimen generation.
  }

  return getGitRef(repoRoot);
}

async function resolvePinnedNodeRuntime(repoRoot: string): Promise<string> {
  const requestedNodeRuntime = process.env.TRUST_CASE_NODE_RUNTIME?.trim();

  if (requestedNodeRuntime) {
    return requestedNodeRuntime;
  }

  try {
    const expectationText = await readFile(
      path.join(repoRoot, "docs", "trust-case", "demo", "EXPECTED_OUTPUTS.json"),
      "utf8"
    );
    const parsed = JSON.parse(expectationText) as {
      build?: {
        runtime?: {
          node?: unknown;
        };
      };
    };

    if (typeof parsed.build?.runtime?.node === "string" && parsed.build.runtime.node.trim().length > 0) {
      return parsed.build.runtime.node;
    }
  } catch {
    // Fall back to the current process version during initial specimen generation.
  }

  return process.version;
}

const NativeDate = Date;

describe("trust case fixture generator", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "Date", {
      value: NativeDate,
      configurable: true,
    });
    setDisplayDateTimeMode("local");
    vi.restoreAllMocks();
  });

  it("generates a frozen trust-case fixture with valid and tampered verification outputs", async () => {
    const fixedNow = "2026-03-13T16:20:00.000Z";

    class FixedDate extends NativeDate {
      constructor(value?: string | number | Date) {
        super(value ?? fixedNow);
      }

      static now() {
        return new NativeDate(fixedNow).getTime();
      }
    }

    Object.defineProperty(globalThis, "Date", {
      value: FixedDate,
      configurable: true,
    });
    setDisplayDateTimeMode("utc");

    const localStorageMock = createLocalStorageMock();
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });

    if (typeof globalThis.atob !== "function") {
      Object.defineProperty(globalThis, "atob", {
        value: (value: string) => Buffer.from(value, "base64").toString("binary"),
        configurable: true,
      });
    }

    if (typeof globalThis.btoa !== "function") {
      Object.defineProperty(globalThis, "btoa", {
        value: (value: string) => Buffer.from(value, "binary").toString("base64"),
        configurable: true,
      });
    }

    const fillDeterministicRandomValues = createDeterministicRandomValues();
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
      fillDeterministicRandomValues(array);
      return array;
    });

    let uuidCounter = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      uuidCounter += 1;
      return `00000000-0000-4000-8000-${uuidCounter.toString().padStart(12, "0")}`;
    });

    const vaultPassphrase = ["vault", "passphrase", "fixture"].join("-");
    const backupPassphrase = ["backup", "passphrase", "fixture"].join("-");
    const repoRoot = getRepoRoot();
    const demoDir = getSpecimenOutputDir(repoRoot);

    const pinnedGitRef = await resolvePinnedGitRef(repoRoot);
    const pinnedNodeRuntime = await resolvePinnedNodeRuntime(repoRoot);

    const attachmentBlob = new Blob(
      [
        "ProofVault trust-case specimen attachment\n",
        "Created to exercise attachment inclusion, integrity references, and export portability.\n",
      ],
      { type: "application/pdf" }
    );
    const attachmentSha256 = await sha256HexFromBlob(attachmentBlob);

    const caseFile: CaseFile = {
      id: "case-trust-2026-001",
      title: "Trust Case Specimen",
      type: "housing",
      description: "Demonstration case used to validate the public trust dossier release flow.",
      status: "active",
      createdAt: "2026-03-10T08:15:00.000Z",
      updatedAt: "2026-03-13T16:20:00.000Z",
    };

    const incidentItem: EvidenceItem = {
      id: "ev-trust-incident-001",
      caseId: caseFile.id,
      kind: "incident",
      title: "Access denial documented",
      description: "Front desk refused entry and stated records were unavailable.",
      occurredAt: "2026-03-11T09:05:00.000Z",
      recordedAt: "2026-03-11T09:09:00.000Z",
      locationText: "Municipal housing office",
      peopleInvolved: ["Front desk clerk", "Neighbor witness"],
      tags: ["access", "housing", "witness"],
      includeInExport: true,
      redactionStatus: "none",
      dateCertainty: "exact",
      createdAt: "2026-03-11T09:09:00.000Z",
      updatedAt: "2026-03-11T09:09:00.000Z",
    };

    const attachmentItem: EvidenceItem = {
      id: "ev-trust-doc-002",
      caseId: caseFile.id,
      kind: "pdf",
      title: "Door notice scan",
      description: "Scanned notice posted after entry denial.",
      recordedAt: "2026-03-12T14:20:00.000Z",
      importedAt: "2026-03-12T14:21:00.000Z",
      originalFilename: "door-notice.pdf",
      mimeType: "application/pdf",
      fileRef: "att-trust-doc-002",
      sha256: attachmentSha256,
      includeInExport: true,
      redactionStatus: "none",
      dateCertainty: "exact",
      createdAt: "2026-03-12T14:21:00.000Z",
      updatedAt: "2026-03-12T14:21:00.000Z",
    };

    const excludedNote: EvidenceItem = {
      id: "ev-trust-note-003",
      caseId: caseFile.id,
      kind: "note",
      title: "Internal follow-up reminder",
      description: "Call clinic records office if no response by Friday.",
      recordedAt: "2026-03-13T08:00:00.000Z",
      includeInExport: false,
      redactionStatus: "none",
      dateCertainty: "exact",
      createdAt: "2026-03-13T08:00:00.000Z",
      updatedAt: "2026-03-13T08:00:00.000Z",
    };

    const attachmentRecord: AttachmentRecord = {
      id: "att-trust-doc-002",
      evidenceItemId: attachmentItem.id,
      blob: attachmentBlob,
      sizeBytes: attachmentBlob.size,
      mimeType: "application/pdf",
      originalFilename: "door-notice.pdf",
      createdAt: "2026-03-12T14:21:00.000Z",
      updatedAt: "2026-03-12T14:21:00.000Z",
    };

    const preparedSession = await prepareSessionConfig(vaultPassphrase);
    const storedCase = await encryptCaseFileForStorageWithKey(caseFile, preparedSession.key);
    const storedIncident = await encryptEvidenceItemForStorageWithKey(incidentItem, preparedSession.key);
    const storedAttachmentItem = await encryptEvidenceItemForStorageWithKey(attachmentItem, preparedSession.key);
    const storedExcludedNote = await encryptEvidenceItemForStorageWithKey(excludedNote, preparedSession.key);

    const hydratedCase = await decryptCaseFileFromStorageWithKey(storedCase, preparedSession.key);
    const hydratedIncident = await decryptEvidenceItemFromStorageWithKey(storedIncident, preparedSession.key);
    const hydratedAttachmentItem = await decryptEvidenceItemFromStorageWithKey(storedAttachmentItem, preparedSession.key);
    const hydratedExcludedNote = await decryptEvidenceItemFromStorageWithKey(storedExcludedNote, preparedSession.key);

    const attachmentLookup = new Map<string, AttachmentRecord>([[attachmentItem.id, attachmentRecord]]);

    seedMockVaultState({
      cases: [storedCase],
      evidenceItems: [storedIncident, storedAttachmentItem, storedExcludedNote],
      exportBundles: [],
      attachments: [attachmentRecord],
      ledger: [],
    });

    vi.mocked(getHydratedAttachmentByEvidenceItemId).mockImplementation(async (evidenceId) => attachmentLookup.get(evidenceId));
    vi.mocked(listLedgerEntries).mockImplementation(async () => [...mockVaultState.ledger]);
    vi.mocked(getLatestLedgerEntry).mockImplementation(async () => mockVaultState.ledger.at(-1));
    vi.mocked(appendLedgerEntry).mockImplementation(async (entry) => {
      mockVaultState.ledger.push(entry);
      return entry.id;
    });
    vi.mocked(upsertExportBundle).mockImplementation(async (bundle) => {
      mockVaultState.exportBundles.push(bundle);
      return bundle.id;
    });

    await appendLedgerEvent({
      event: "case.created",
      caseId: caseFile.id,
      data: {
        title: caseFile.title,
        type: caseFile.type,
      },
    });

    await appendLedgerEvent({
      event: "evidence.linked",
      caseId: caseFile.id,
      attachmentId: attachmentRecord.id,
      data: {
        evidenceId: attachmentItem.id,
        sha256: attachmentItem.sha256,
      },
    });

    await generateExportPacket({
      caseFile: hydratedCase,
      items: [hydratedIncident, hydratedAttachmentItem, hydratedExcludedNote],
      mode: "full",
      includeAttachments: true,
      includeMetadataAppendix: true,
    });

    expect(downloadBlobFile).toHaveBeenCalledTimes(1);
  expect(mockVaultState.exportBundles).toHaveLength(1);

    const exportDownload = readDownloadCall(0);
    const archiveBuffer = await exportDownload.blob.arrayBuffer();
    const archive = await JSZip.loadAsync(archiveBuffer);
    const archiveFiles = collectArchiveFiles(archive);
    const exportManifestFileName = archiveFiles.find(
      (fileName) => fileName.startsWith("manifest-") && fileName.endsWith(".json")
    );

    if (!exportManifestFileName) {
      throw new Error("Expected an export manifest JSON file in the archive.");
    }

    const fingerprintText = await archive.file("FINGERPRINT.txt")!.async("string");
    const proofManifestText = await archive.file("proof-vault-evidence.json")!.async("string");
    const exportManifestText = await archive.file(exportManifestFileName)!.async("string");
    const caseSummaryText = await archive.file("case-summary.txt")!.async("string");
    const timelineMarkdown = await archive.file("timeline.md")!.async("string");
    const timelineCsv = await archive.file("timeline.csv")!.async("string");
    const metadataAppendix = await archive.file("metadata-appendix.md")!.async("string");
    const ledgerAuditText = await archive.file("ledger-audit.json")!.async("string");
    const exportedAttachment = await archive.file("attachments/door-notice.pdf")!.async("nodebuffer");
    const proofManifest = parseProofVaultEvidenceManifest(proofManifestText);

    const securityConfig = {
      version: 1 as const,
      salt: preparedSession.salt,
      verifier: preparedSession.verifier,
      preferences: preparedSession.preferences,
    };

    vi.mocked(getStoredSecurityConfigForBackup).mockReturnValue(securityConfig);

    await exportEncryptedBackup(backupPassphrase);

    expect(downloadBlobFile).toHaveBeenCalledTimes(2);

    const backupDownload = readDownloadCall(1);
    const backupFile = new File([backupDownload.blob], backupDownload.fileName, {
      type: "application/json",
      lastModified: Date.parse("2026-03-13T16:20:00.000Z"),
    });

    const backupSnapshot = await readVerificationSnapshotFromBackup(
      backupFile,
      backupPassphrase,
      vaultPassphrase
    );

    const validVerification = await verifyProofVaultEvidenceManifest({
      manifest: proofManifest,
      caseFile: backupSnapshot.cases[0],
      items: backupSnapshot.evidenceItems,
    });

    const validReport = await buildVerificationReport({
      manifest: proofManifest,
      caseTitle: backupSnapshot.cases[0]?.title,
      verification: validVerification,
      verificationSource: "backup-snapshot",
      backupSnapshot,
      generatedAt: "2026-03-13T16:24:00.000Z",
    });

    const tamperedManifest = structuredClone(proofManifest);
    tamperedManifest.evidenceRecords[0] = {
      ...tamperedManifest.evidenceRecords[0],
      provenance: {
        ...tamperedManifest.evidenceRecords[0].provenance,
        integrityRef: "f".repeat(64),
      },
    };

    const tamperedVerification = await verifyProofVaultEvidenceManifest({
      manifest: tamperedManifest,
      caseFile: backupSnapshot.cases[0],
      items: backupSnapshot.evidenceItems,
    });

    const tamperedReport = await buildVerificationReport({
      manifest: tamperedManifest,
      caseTitle: backupSnapshot.cases[0]?.title,
      verification: tamperedVerification,
      verificationSource: "backup-snapshot",
      backupSnapshot,
      generatedAt: "2026-03-13T16:26:00.000Z",
    });

    expect(validVerification.status).toBe("verified");
    expect(validVerification.verified).toBe(2);
    expect(validVerification.mismatched).toBe(0);
    expect(validVerification.missing).toBe(0);
    expect(validVerification.manifestSealValid).toBe(true);

    expect(tamperedVerification.status).toBe("mismatch");
    expect(tamperedVerification.mismatched).toBeGreaterThanOrEqual(1);
    expect(tamperedVerification.manifestSealValid).toBe(false);

    vi.mocked(downloadBlobFile).mockClear();

    await generateExportPacket({
      caseFile: hydratedCase,
      items: [hydratedIncident, hydratedAttachmentItem, hydratedExcludedNote],
      mode: "redacted",
      includeAttachments: true,
      includeMetadataAppendix: true,
    });

    const redactedDownload = readDownloadCall(0);
    const redactedArchive = await JSZip.loadAsync(await redactedDownload.blob.arrayBuffer());
    const redactedArchiveFiles = collectArchiveFiles(redactedArchive);
    const redactedManifestFileName = redactedArchiveFiles.find(
      (fileName) => fileName.startsWith("manifest-") && fileName.endsWith(".json")
    );

    if (!redactedManifestFileName) {
      throw new Error("Expected a redacted export manifest JSON file in the archive.");
    }

    const redactedManifestText = await redactedArchive.file(redactedManifestFileName)!.async("string");
    const redactedMetadataAppendix = await redactedArchive.file("metadata-appendix.md")!.async("string");
    const redactedAttachmentFiles = redactedArchiveFiles.filter(
      (fileName) => fileName.startsWith("attachments/") && fileName !== "attachments/"
    );

    expect(redactedManifestText).not.toContain("door-notice.pdf");
    expect(redactedManifestText).not.toContain(attachmentSha256);
    expect(redactedMetadataAppendix).not.toContain("Front desk clerk");
    expect(redactedMetadataAppendix).not.toContain("Neighbor witness");
    expect(redactedMetadataAppendix).not.toContain("door-notice.pdf");
    expect(redactedAttachmentFiles).toHaveLength(1);

    vi.mocked(downloadBlobFile).mockClear();

    await generateExportPacket({
      caseFile: hydratedCase,
      items: [hydratedIncident, hydratedAttachmentItem, hydratedExcludedNote],
      mode: "minimal",
      includeAttachments: true,
      includeMetadataAppendix: true,
    });

    const minimalDownload = readDownloadCall(0);
    const minimalArchive = await JSZip.loadAsync(await minimalDownload.blob.arrayBuffer());
    const minimalArchiveFiles = collectArchiveFiles(minimalArchive);
    const minimalManifestFileName = minimalArchiveFiles.find(
      (fileName) => fileName.startsWith("manifest-") && fileName.endsWith(".json")
    );

    if (!minimalManifestFileName) {
      throw new Error("Expected a minimal export manifest JSON file in the archive.");
    }

    const minimalManifestText = await minimalArchive.file(minimalManifestFileName)!.async("string");

    expect(minimalArchive.file("metadata-appendix.md")).toBeNull();
    expect(minimalArchiveFiles.some((fileName) => fileName.startsWith("attachments/"))).toBe(false);
    expect(minimalManifestText).not.toContain("peopleInvolved");
    expect(minimalManifestText).not.toContain("tags");
    expect(minimalManifestText).not.toContain("sha256");
    expect(minimalManifestText).not.toContain("originalFilename");

    attachmentLookup.delete(attachmentItem.id);
    vi.mocked(downloadBlobFile).mockClear();

    await generateExportPacket({
      caseFile: hydratedCase,
      items: [hydratedAttachmentItem],
      mode: "full",
      includeAttachments: true,
      includeMetadataAppendix: false,
    });

    const missingAttachmentDownload = readDownloadCall(0);
    const missingAttachmentArchive = await JSZip.loadAsync(await missingAttachmentDownload.blob.arrayBuffer());
    const missingAttachmentManifestFileName = collectArchiveFiles(missingAttachmentArchive).find(
      (fileName) => fileName.startsWith("manifest-") && fileName.endsWith(".json")
    );

    if (!missingAttachmentManifestFileName) {
      throw new Error("Expected a missing-attachment manifest JSON file in the archive.");
    }

    const missingAttachmentManifest = JSON.parse(
      await missingAttachmentArchive.file(missingAttachmentManifestFileName)!.async("string")
    ) as {
      items: Array<{
        id: string;
        attachmentStatus?: string;
        attachmentPath?: string;
        omissionReason?: string;
      }>;
    };
    const missingAttachmentItem = missingAttachmentManifest.items.find((item) => item.id === attachmentItem.id);

    expect(missingAttachmentItem?.attachmentStatus).toBe("missing");
    expect(missingAttachmentItem?.attachmentPath).toBeUndefined();
    expect(missingAttachmentItem?.omissionReason).toBe("attachment-missing");

    attachmentLookup.set(attachmentItem.id, attachmentRecord);

    let wrongBackupError = "";

    try {
      await readVerificationSnapshotFromBackup(
        backupFile,
        ["wrong", "backup", "passphrase", "fixture"].join("-"),
        vaultPassphrase
      );
    } catch (error) {
      wrongBackupError = error instanceof Error ? error.message : String(error);
    }

    expect(wrongBackupError).toContain("incorrect");

    const staleVerification = await verifyProofVaultEvidenceManifest({
      manifest: proofManifest,
      caseFile: backupSnapshot.cases[0],
      items: backupSnapshot.evidenceItems.map((item, index) =>
        index === 0
          ? {
              ...item,
              description: "Post-export mutation introduced after the pinned release artifact was captured.",
            }
          : item
      ),
    });

    expect(staleVerification.status).toBe("mismatch");
    expect(staleVerification.mismatched).toBeGreaterThanOrEqual(1);

    const rollbackCurrentCase: CaseFile = {
      id: "case-live-before-restore",
      title: "Live Vault Before Restore",
      type: "other",
      description: "Current vault state captured immediately before applying the staged trust-case restore.",
      status: "active",
      createdAt: "2026-03-13T15:50:00.000Z",
      updatedAt: "2026-03-13T16:10:00.000Z",
    };
    const rollbackCurrentItem: EvidenceItem = {
      id: "ev-live-before-restore",
      caseId: rollbackCurrentCase.id,
      kind: "note",
      title: "Current vault note",
      description: "This note should reappear when the rollback snapshot is restored.",
      recordedAt: "2026-03-13T16:05:00.000Z",
      includeInExport: true,
      redactionStatus: "none",
      dateCertainty: "exact",
      createdAt: "2026-03-13T16:05:00.000Z",
      updatedAt: "2026-03-13T16:05:00.000Z",
    };
    const storedRollbackCurrentCase = await encryptCaseFileForStorageWithKey(rollbackCurrentCase, preparedSession.key);
    const storedRollbackCurrentItem = await encryptEvidenceItemForStorageWithKey(rollbackCurrentItem, preparedSession.key);
    const rollbackSnapshotCountBefore = (await listRollbackSnapshots()).length;

    seedMockVaultState({
      cases: [storedRollbackCurrentCase],
      evidenceItems: [storedRollbackCurrentItem],
      exportBundles: [],
      attachments: [],
      ledger: [],
    });

    const stagedImport = await importEncryptedBackup(backupFile, backupPassphrase, {
      includeAttachments: true,
      includeExportBundles: true,
    });

    expect(stagedImport.status).toBe("staged");

    if (stagedImport.status !== "staged") {
      throw new Error("Expected the first restore attempt to stage the backup.");
    }

    const promotedImport = await importEncryptedBackup(backupFile, backupPassphrase, {
      includeAttachments: true,
      includeExportBundles: true,
      confirmationToken: stagedImport.stagedRestore.stageId,
    });

    expect(promotedImport.status).toBe("restored");

    if (promotedImport.status !== "restored") {
      throw new Error("Expected the staged backup confirmation to promote the restore.");
    }

    const rollbackSnapshotsAfterPromote = await listRollbackSnapshots();
    const promotedRollbackSnapshot = rollbackSnapshotsAfterPromote.find(
      (snapshot) => snapshot.id === promotedImport.rollbackSnapshotId
    );

    expect(rollbackSnapshotsAfterPromote.length).toBe(rollbackSnapshotCountBefore + 1);
    expect(promotedRollbackSnapshot).toMatchObject({
      counts: {
        cases: 1,
        evidenceItems: 1,
        attachments: 0,
        exportBundles: 0,
        ledger: 0,
      },
    });
    expect((await mockDb.cases.toArray()).map((item) => item.id)).toEqual([caseFile.id]);

    const rollbackRestoreResult = await restoreRollbackSnapshot(promotedImport.rollbackSnapshotId);
    const rollbackSnapshotsAfterRollback = await listRollbackSnapshots();

    expect(rollbackRestoreResult.status).toBe("restored");
    expect(rollbackSnapshotsAfterRollback.length).toBe(rollbackSnapshotsAfterPromote.length + 1);
    expect((await mockDb.cases.toArray()).map((item) => item.id)).toEqual([rollbackCurrentCase.id]);

    const certificateHtml = generateClinicalVerificationCertificateHtml(validReport);
    const expectations = {
      release: "ProofVault Trust Case v1.0",
      build: {
        gitRef: pinnedGitRef,
        generatedAt: "2026-03-13T16:20:00.000Z",
        runtime: {
          node: pinnedNodeRuntime,
          webCrypto: true,
          deterministicHarness: true,
        },
      },
      fixture: {
        caseId: caseFile.id,
        caseTitle: caseFile.title,
        exportMode: "full",
        includeAttachments: true,
        includeMetadataAppendix: true,
        exportedAt: proofManifest.exportedAt,
        recordCount: proofManifest.recordCount,
        archiveFiles,
        validRunStatus: validReport.status,
        tamperRunStatus: tamperedReport.status,
        matrix: {
          fullExport: {
            archiveFile: exportDownload.fileName,
            status: validReport.status,
            attachmentCount: archiveFiles.filter(
              (fileName) => fileName.startsWith("attachments/") && fileName !== "attachments/"
            ).length,
          },
          redactedExport: {
            archiveFile: redactedDownload.fileName,
            strippedOriginalFilename: !redactedManifestText.includes("door-notice.pdf"),
            strippedAttachmentSha256: !redactedManifestText.includes(attachmentSha256),
            strippedPeopleInvolved:
              !redactedMetadataAppendix.includes("Front desk clerk") &&
              !redactedMetadataAppendix.includes("Neighbor witness"),
            exportedAttachmentCount: redactedAttachmentFiles.length,
          },
          minimalExport: {
            archiveFile: minimalDownload.fileName,
            attachmentEntriesPresent: minimalArchiveFiles.some((fileName) => fileName.startsWith("attachments/")),
            metadataAppendixPresent: minimalArchive.file("metadata-appendix.md") !== null,
            strippedSensitiveFields:
              !minimalManifestText.includes("peopleInvolved") &&
              !minimalManifestText.includes("tags") &&
              !minimalManifestText.includes("sha256") &&
              !minimalManifestText.includes("originalFilename"),
          },
          missingAttachmentCase: {
            archiveFile: missingAttachmentDownload.fileName,
            attachmentStatus: missingAttachmentItem?.attachmentStatus ?? "unknown",
            omissionReason: missingAttachmentItem?.omissionReason ?? null,
            attachmentPathPresent: Boolean(missingAttachmentItem?.attachmentPath),
          },
          wrongBackupCase: {
            rejected: wrongBackupError.includes("incorrect"),
            error: wrongBackupError,
          },
          staleManifestCase: {
            status: staleVerification.status,
            mismatched: staleVerification.mismatched,
            manifestSealValid: staleVerification.manifestSealValid,
          },
          restoreRollbackCase: {
            stagedStatus: stagedImport.status,
            promotedStatus: promotedImport.status,
            rollbackRestoreStatus: rollbackRestoreResult.status,
            rollbackSnapshotId: promotedImport.rollbackSnapshotId,
            snapshotCountBefore: rollbackSnapshotCountBefore,
            snapshotCountAfterPromote: rollbackSnapshotsAfterPromote.length,
            snapshotCountAfterRollback: rollbackSnapshotsAfterRollback.length,
          },
        },
      },
      files: {
        exportZip: exportDownload.fileName,
        encryptedBackup: backupDownload.fileName,
        exportManifest: exportManifestFileName,
        proofManifest: "proof-vault-evidence.json",
        verificationReport: "proofvault-verification-report.json",
        tamperedVerificationReport: "proofvault-verification-report-tampered.json",
        certificate: "proofvault-verification-certificate.html",
        fingerprint: "FINGERPRINT.txt",
        metadataAppendix: "metadata-appendix.md",
        ledgerAudit: "ledger-audit.json",
      },
      checksums: {
        manifestIntegritySeal: proofManifest.integritySeal,
        shortManifestFingerprint: shortFingerprint(proofManifest.integritySeal),
        verificationReportSha256: validReport.reportSha256,
        tamperedVerificationReportSha256: tamperedReport.reportSha256,
        backupSnapshotSha256: backupSnapshot.snapshotSha256,
        attachmentSha256,
      },
      verification: {
        valid: validVerification,
        tampered: tamperedVerification,
      },
      notes: [
        "The fixture is generated under a fixed Date shim and deterministic random values so names, hashes, and encryption envelopes are stable.",
        "The printable certificate is emitted as HTML because the current implementation opens a print-ready document rather than exporting a PDF file directly.",
        "The ledger audit captured inside the ZIP reflects the case ledger before the export.generated event is appended at the end of archive creation.",
        "Expanded matrix coverage is recorded inside fixture.matrix so the pinned release artifact documents serializer behavior, backup failures, stale-manifest detection, and rollback snapshot promotion without checking in multiple redundant ZIPs.",
      ],
    };

    const baselineText = [
      "# Specimen Baseline",
      "",
      `- Release: ${expectations.release}`,
      `- Git ref: ${expectations.build.gitRef}`,
      `- Generated at: ${expectations.build.generatedAt}`,
      `- Node runtime: ${expectations.build.runtime.node}`,
      "- Browser/runtime assumptions: Web Crypto, Blob, File, and JSON ZIP handling are available and behave consistently with the current build.",
      "- Environment sensitivity: export filenames, proof manifests, backup envelopes, archive entry metadata, and checksums are pinned by a fixed Date shim plus deterministic random bytes in the generator harness.",
      "",
    ].join("\n");

    const specimenNotes = [
      "# Fixture Case Notes",
      "",
      `- Case: ${caseFile.title} (${caseFile.id})`,
      "- Export mode: full",
      "- Exported records: 2 included, 1 excluded",
      "- Included evidence: Access denial documented; Door notice scan",
      "- Attachment included: door-notice.pdf",
      "- Verification contrast: valid backup-snapshot verification plus one tampered-manifest mismatch run",
      "",
    ].join("\n");

    await mkdir(demoDir, { recursive: true });
    await writeFile(path.join(demoDir, exportDownload.fileName), Buffer.from(archiveBuffer));
    await writeFile(path.join(demoDir, backupDownload.fileName), Buffer.from(await backupDownload.blob.arrayBuffer()));
    await writeFile(path.join(demoDir, exportManifestFileName), exportManifestText);
    await writeFile(path.join(demoDir, "proof-vault-evidence.json"), proofManifestText);
    await writeFile(path.join(demoDir, "FINGERPRINT.txt"), fingerprintText);
    await writeFile(path.join(demoDir, "case-summary.txt"), caseSummaryText);
    await writeFile(path.join(demoDir, "timeline.md"), timelineMarkdown);
    await writeFile(path.join(demoDir, "timeline.csv"), timelineCsv);
    await writeFile(path.join(demoDir, "metadata-appendix.md"), metadataAppendix);
    await writeFile(path.join(demoDir, "ledger-audit.json"), ledgerAuditText);
    await writeFile(path.join(demoDir, "proofvault-verification-report.json"), toPrettyJson(validReport));
    await writeFile(path.join(demoDir, "proofvault-verification-report-tampered.json"), toPrettyJson(tamperedReport));
    await writeFile(path.join(demoDir, "proofvault-verification-certificate.html"), certificateHtml);
    await writeFile(path.join(demoDir, "CASE_NOTES.md"), specimenNotes);
    await writeFile(path.join(demoDir, "SPECIMEN_BASELINE.md"), baselineText);
    await writeFile(path.join(demoDir, "EXPECTED_OUTPUTS.json"), toPrettyJson(expectations));
    await writeFile(path.join(demoDir, "attachments-door-notice.pdf"), exportedAttachment);

    expect(fingerprintText).toContain("ProofVault Export Fingerprint");
    expect(fingerprintText).toContain(`Manifest Seal SHA-256: ${proofManifest.integritySeal}`);
    expect(exportManifestText).toContain("proof-vault-evidence.json");
    expect(caseSummaryText).toContain(caseFile.title);
    expect(metadataAppendix).toContain("Case Report");
    expect(ledgerAuditText).toContain("evidence.linked");
    expect(certificateHtml).toContain("ProofVault Certificate of Integrity");
  }, 60000);
});