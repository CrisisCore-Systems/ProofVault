import type { CaseFile, EvidenceItem, ExportBundle } from "../../domain/types";
import { sha256HexFromText } from "../hashing/sha256";
import type {
  ProofVaultEvidenceManifest,
  ProofVaultEvidenceRecord,
  ProofVaultExportFormat,
  ProofVaultRedactionPolicy,
  ProofVaultSourceSnapshot,
} from "../../types/proof-vault";
import {
  createExportSerializationPolicy,
  resolveProofPolicyOmissions,
  serializeEvidenceItemForExport,
} from "./serializationPolicy";

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeys(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function buildSourceSnapshot(item: EvidenceItem): ProofVaultSourceSnapshot {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    description: item.description,
    occurredAt: item.occurredAt,
    recordedAt: item.recordedAt,
    locationText: item.locationText,
    peopleInvolved: item.peopleInvolved,
    tags: item.tags,
    fileRef: item.fileRef,
    originalFilename: item.originalFilename,
    mimeType: item.mimeType,
    sha256: item.sha256,
    redactions: item.redactions,
    includeInExport: item.includeInExport,
    redactionStatus: item.redactionStatus,
    dateCertainty: item.dateCertainty,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    encryptedPayload: item.encryptedPayload,
  };
}

async function hashValue(value: unknown): Promise<string> {
  return sha256HexFromText(canonicalize(value));
}

export function createProofVaultRedactionPolicy(options: {
  mode: ExportBundle["mode"];
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
}): ProofVaultRedactionPolicy {
  const policy = createExportSerializationPolicy(options);

  return {
    id: policy.id,
    mode: policy.mode,
    label: policy.label,
    omittedFields: [...policy.omittedFields],
    includeAttachments: policy.includeAttachments,
    includeMetadataAppendix: policy.includeMetadataAppendix,
  };
}

export async function buildProofVaultEvidenceRecord(input: {
  item: EvidenceItem;
  exportTimestamp: string;
  outputFormat: ProofVaultExportFormat;
  redactionPolicy: ProofVaultRedactionPolicy;
}): Promise<ProofVaultEvidenceRecord> {
  const serializerPolicy = createExportSerializationPolicy({
    mode: input.redactionPolicy.mode,
    includeAttachments: input.redactionPolicy.includeAttachments,
    includeMetadataAppendix: input.redactionPolicy.includeMetadataAppendix,
  });
  const serializedItem = serializeEvidenceItemForExport(input.item, serializerPolicy);
  const sourceSnapshot = buildSourceSnapshot(serializedItem);
  const omittedFields = resolveProofPolicyOmissions(
    serializerPolicy,
    input.redactionPolicy.includeAttachments,
    (input.item.redactions?.length ?? 0) > 0
  );

  const encryptedPayloadRef = serializedItem.encryptedPayload ? await hashValue(serializedItem.encryptedPayload) : null;
  const attachmentRef = serializedItem.sha256 ?? null;
  const sourceSnapshotRef = await hashValue(sourceSnapshot);
  const integrityRef = await hashValue({
    sourceId: serializedItem.id,
    encryptedPayloadRef,
    attachmentRef,
    sourceSnapshotRef,
  });

  const integritySeal = await hashValue({
    sourceId: serializedItem.id,
    provenance: {
      integrityRef,
      encryptedPayloadRef,
      sourceSnapshotRef,
      attachmentRef,
    },
    omittedFields,
    exportTimestamp: input.exportTimestamp,
    redactionPolicyId: input.redactionPolicy.id,
  });

  return {
    sourceId: serializedItem.id,
    provenance: {
      integrityRef,
      encryptedPayloadRef,
      sourceSnapshotRef,
      attachmentRef,
    },
    exportContext: {
      redactionPolicy: input.redactionPolicy,
      exportTimestamp: input.exportTimestamp,
      outputFormat: input.outputFormat,
    },
    omittedFields,
    integritySeal,
  };
}

export async function buildProofVaultEvidenceManifest(input: {
  caseFile: CaseFile;
  items: EvidenceItem[];
  exportTimestamp: string;
  outputFormat: ProofVaultExportFormat;
  redactionPolicy: ProofVaultRedactionPolicy;
}): Promise<ProofVaultEvidenceManifest> {
  const evidenceRecords = await Promise.all(
    input.items.map((item) =>
      buildProofVaultEvidenceRecord({
        item,
        exportTimestamp: input.exportTimestamp,
        outputFormat: input.outputFormat,
        redactionPolicy: input.redactionPolicy,
      })
    )
  );

  const integritySeal = await buildProofVaultEvidenceManifestIntegritySeal({
    caseId: input.caseFile.id,
    exportTimestamp: input.exportTimestamp,
    outputFormat: input.outputFormat,
    redactionPolicy: input.redactionPolicy,
    evidenceRecords,
  });

  return {
    schemaVersion: 1,
    caseId: input.caseFile.id,
    exportedAt: input.exportTimestamp,
    outputFormat: input.outputFormat,
    recordCount: evidenceRecords.length,
    evidenceRecords,
    integritySeal,
  };
}

export async function buildProofVaultEvidenceManifestIntegritySeal(input: {
  caseId: string;
  exportTimestamp: string;
  outputFormat: ProofVaultExportFormat;
  redactionPolicy: ProofVaultRedactionPolicy;
  evidenceRecords: ProofVaultEvidenceRecord[];
}): Promise<string> {
  return hashValue({
    caseId: input.caseId,
    exportTimestamp: input.exportTimestamp,
    outputFormat: input.outputFormat,
    redactionPolicy: input.redactionPolicy,
    evidenceRecords: input.evidenceRecords,
  });
}