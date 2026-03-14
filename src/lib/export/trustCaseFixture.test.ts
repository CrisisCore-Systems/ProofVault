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
import { exportEncryptedBackup, readVerificationSnapshotFromBackup } from "../../features/security/backup";
import {
  decryptCaseFileFromStorageWithKey,
  decryptEvidenceItemFromStorageWithKey,
  encryptCaseFileForStorageWithKey,
  encryptEvidenceItemForStorageWithKey,
} from "../../features/security/storage";
import { appendLedgerEvent } from "../../features/ledger/chain";
import { downloadBlobFile } from "../utils/download";
import { sha256HexFromBlob } from "../hashing/sha256";
import { generateClinicalVerificationCertificateHtml } from "./clinicalReportPdf";
import { generateExportPacket } from "./exportBundle";
import { shortFingerprint } from "./integrityFingerprints";
import { parseProofVaultEvidenceManifest, verifyProofVaultEvidenceManifest } from "./proofVerifier";
import { buildVerificationReport } from "./verificationReport";

type MockTable<T> = {
  toArray: ReturnType<typeof vi.fn<() => Promise<T[]>>>;
};

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    cases: { toArray: vi.fn() },
    evidenceItems: { toArray: vi.fn() },
    exportBundles: { toArray: vi.fn() },
    attachments: { toArray: vi.fn() },
    ledger: { toArray: vi.fn() },
  } satisfies {
    cases: MockTable<CaseFile>;
    evidenceItems: MockTable<EvidenceItem>;
    exportBundles: MockTable<ExportBundle>;
    attachments: MockTable<AttachmentRecord>;
    ledger: MockTable<LedgerEntry>;
  },
}));

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

const NativeDate = Date;

describe("trust case fixture generator", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "Date", {
      value: NativeDate,
      configurable: true,
    });
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

    const ledgerEntries: LedgerEntry[] = [];
    const exportBundles: ExportBundle[] = [];

    vi.mocked(getHydratedAttachmentByEvidenceItemId).mockImplementation(async (evidenceId) =>
      evidenceId === attachmentItem.id ? attachmentRecord : undefined
    );
    vi.mocked(listLedgerEntries).mockImplementation(async () => [...ledgerEntries]);
    vi.mocked(getLatestLedgerEntry).mockImplementation(async () => ledgerEntries.at(-1));
    vi.mocked(appendLedgerEntry).mockImplementation(async (entry) => {
      ledgerEntries.push(entry);
      return entry.id;
    });
    vi.mocked(upsertExportBundle).mockImplementation(async (bundle) => {
      exportBundles.push(bundle);
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
    expect(exportBundles).toHaveLength(1);

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

    mockDb.cases.toArray.mockResolvedValue([storedCase]);
    mockDb.evidenceItems.toArray.mockResolvedValue([storedIncident, storedAttachmentItem, storedExcludedNote]);
    mockDb.exportBundles.toArray.mockResolvedValue([...exportBundles]);
    mockDb.attachments.toArray.mockResolvedValue([attachmentRecord]);
    mockDb.ledger.toArray.mockResolvedValue([...ledgerEntries]);

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

    const certificateHtml = generateClinicalVerificationCertificateHtml(validReport);
    const expectations = {
      release: "ProofVault Trust Case v1.0",
      build: {
        gitRef: pinnedGitRef,
        generatedAt: "2026-03-13T16:20:00.000Z",
        runtime: {
          node: process.version,
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
      "- Environment sensitivity: export filenames, proof manifests, backup envelopes, and checksums are pinned by a fixed Date shim plus deterministic random bytes in the generator harness.",
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