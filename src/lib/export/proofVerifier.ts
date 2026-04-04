import { z } from "zod";
import type { CaseFile, EvidenceItem } from "../../domain/types";
import type {
  ProofVaultEvidenceManifest,
  ProofVaultEvidenceRecord,
  ProofVaultExportFormat,
  ProofVaultRedactionPolicy,
} from "../../types/proof-vault";
import { buildProofVaultEvidenceManifestIntegritySeal, buildProofVaultEvidenceRecord } from "./proofVault";

const ProofVaultSourceFieldSchema = z.enum([
  "attachment",
  "description",
  "encryptedPayload",
  "locationText",
  "occurredAt",
  "originalFilename",
  "peopleInvolved",
  "redactions",
  "sha256",
  "tags",
]);

const ProofVaultRedactionPolicySchema = z.object({
  id: z.enum(["full", "redacted", "minimal"]),
  mode: z.enum(["full", "redacted", "minimal"]),
  label: z.string().min(1),
  omittedFields: z.array(ProofVaultSourceFieldSchema),
  includeAttachments: z.boolean(),
  includeMetadataAppendix: z.boolean(),
});

const ProofVaultEvidenceRecordSchema = z.object({
  sourceId: z.string().min(1),
  provenance: z.object({
    integrityRef: z.string().length(64),
    encryptedPayloadRef: z.string().length(64).nullable(),
    sourceSnapshotRef: z.string().length(64),
    attachmentRef: z.string().min(1).nullable(),
  }),
  exportContext: z.object({
    redactionPolicy: ProofVaultRedactionPolicySchema,
    exportTimestamp: z.iso.datetime(),
    outputFormat: z.enum(["zip", "pdf", "csv"]),
  }),
  omittedFields: z.array(ProofVaultSourceFieldSchema),
  integritySeal: z.string().length(64),
});

const ProofVaultEvidenceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  exportedAt: z.iso.datetime(),
  outputFormat: z.enum(["zip", "pdf", "csv"]),
  recordCount: z.number().int().nonnegative(),
  evidenceRecords: z.array(ProofVaultEvidenceRecordSchema),
  integritySeal: z.string().length(64),
});

export type ProofVaultRecordVerificationResult = {
  sourceId: string;
  status: "verified" | "mismatch" | "missing";
  issues: string[];
};

export type ProofVaultManifestVerificationResult = {
  status: "verified" | "mismatch";
  issues: string[];
  verified: number;
  mismatched: number;
  missing: number;
  manifestSealValid: boolean;
  records: ProofVaultRecordVerificationResult[];
};

function sortStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function collectRecordIssues(actual: ProofVaultEvidenceRecord, expected: ProofVaultEvidenceRecord): string[] {
  const issues: string[] = [];

  if (actual.provenance.integrityRef !== expected.provenance.integrityRef) {
    issues.push("Integrity reference does not match current vault state.");
  }

  if (actual.provenance.encryptedPayloadRef !== expected.provenance.encryptedPayloadRef) {
    issues.push("Encrypted payload provenance does not match current vault state.");
  }

  if (actual.provenance.sourceSnapshotRef !== expected.provenance.sourceSnapshotRef) {
    issues.push("Source snapshot provenance does not match current vault state.");
  }

  if (actual.provenance.attachmentRef !== expected.provenance.attachmentRef) {
    issues.push("Attachment provenance does not match current vault state.");
  }

  if (!sameStrings(sortStrings(actual.omittedFields), sortStrings(expected.omittedFields))) {
    issues.push("Omitted field claims do not match the applied redaction policy.");
  }

  if (actual.integritySeal !== expected.integritySeal) {
    issues.push("Record integrity seal is invalid for the current vault state.");
  }

  return issues;
}

function resolveSharedContext(records: ProofVaultEvidenceRecord[]): {
  outputFormat: ProofVaultExportFormat;
  redactionPolicy: ProofVaultRedactionPolicy;
  exportTimestamp: string;
} | null {
  const first = records[0];
  if (!first) {
    return null;
  }

  const consistent = records.every(
    (record) =>
      record.exportContext.outputFormat === first.exportContext.outputFormat &&
      record.exportContext.exportTimestamp === first.exportContext.exportTimestamp &&
      JSON.stringify(record.exportContext.redactionPolicy) === JSON.stringify(first.exportContext.redactionPolicy)
  );

  if (!consistent) {
    return null;
  }

  return {
    outputFormat: first.exportContext.outputFormat,
    redactionPolicy: first.exportContext.redactionPolicy,
    exportTimestamp: first.exportContext.exportTimestamp,
  };
}

export function parseProofVaultEvidenceManifest(jsonText: string): ProofVaultEvidenceManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Proof manifest is not valid JSON.");
  }

  return ProofVaultEvidenceManifestSchema.parse(parsed);
}

async function verifyManifestRecord(
  record: ProofVaultEvidenceRecord,
  item: EvidenceItem | undefined,
  seenIds: Set<string>
): Promise<ProofVaultRecordVerificationResult> {
  if (seenIds.has(record.sourceId)) {
    return {
      sourceId: record.sourceId,
      status: "mismatch",
      issues: ["Manifest contains duplicate source IDs."],
    };
  }

  seenIds.add(record.sourceId);

  if (!item) {
    return {
      sourceId: record.sourceId,
      status: "missing",
      issues: ["Source item is missing from the supplied vault snapshot."],
    };
  }

  const expected = await buildProofVaultEvidenceRecord({
    item,
    exportTimestamp: record.exportContext.exportTimestamp,
    outputFormat: record.exportContext.outputFormat,
    redactionPolicy: record.exportContext.redactionPolicy,
  });

  const recordIssues = collectRecordIssues(record, expected);

  return {
    sourceId: record.sourceId,
    status: recordIssues.length === 0 ? "verified" : "mismatch",
    issues: recordIssues,
  };
}

async function verifyManifestSeal(
  manifest: ProofVaultEvidenceManifest,
  issues: string[]
): Promise<boolean> {
  const sharedContext = resolveSharedContext(manifest.evidenceRecords);

  if (sharedContext === null) {
    issues.push("Manifest records do not share a consistent export context.");
    return false;
  }

  const computedSeal = await buildProofVaultEvidenceManifestIntegritySeal({
    caseId: manifest.caseId,
    exportTimestamp: sharedContext.exportTimestamp,
    outputFormat: sharedContext.outputFormat,
    redactionPolicy: sharedContext.redactionPolicy,
    evidenceRecords: manifest.evidenceRecords,
  });

  const sealMatches = computedSeal === manifest.integritySeal;

  if (!sealMatches) {
    issues.push("Manifest integrity seal does not match the embedded evidence records.");
  }

  return sealMatches;
}

export async function verifyProofVaultEvidenceManifest(input: {
  manifest: ProofVaultEvidenceManifest;
  caseFile?: Pick<CaseFile, "id">;
  items: EvidenceItem[];
}): Promise<ProofVaultManifestVerificationResult> {
  const issues: string[] = [];
  const itemsById = new Map(input.items.map((item) => [item.id, item]));
  const seenIds = new Set<string>();

  if (input.caseFile && input.caseFile.id !== input.manifest.caseId) {
    issues.push("Manifest case ID does not match the supplied vault snapshot.");
  }

  if (input.manifest.recordCount !== input.manifest.evidenceRecords.length) {
    issues.push("Manifest record count does not match the number of embedded evidence records.");
  }

  const records = await Promise.all(
    input.manifest.evidenceRecords.map((record) => verifyManifestRecord(record, itemsById.get(record.sourceId), seenIds))
  );

  const manifestSealValid = await verifyManifestSeal(input.manifest, issues);

  const mismatched = records.filter((record) => record.status === "mismatch").length;
  const missing = records.filter((record) => record.status === "missing").length;
  const verified = records.filter((record) => record.status === "verified").length;

  return {
    status: issues.length === 0 && mismatched === 0 && missing === 0 ? "verified" : "mismatch",
    issues,
    verified,
    mismatched,
    missing,
    manifestSealValid,
    records,
  };
}