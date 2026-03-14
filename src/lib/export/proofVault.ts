import type { CaseFile, EvidenceItem, ExportBundle } from "../../domain/types";
import { sha256HexFromText } from "../hashing/sha256";
import type {
  ProofVaultEvidenceManifest,
  ProofVaultEvidenceRecord,
  ProofVaultExportFormat,
  ProofVaultRedactionPolicy,
  ProofVaultSourceField,
  ProofVaultSourceSnapshot,
} from "../../types/proof-vault";

const MINIMAL_POLICY_OMISSIONS: ProofVaultSourceField[] = [
  "attachment",
  "description",
  "encryptedPayload",
  "locationText",
  "originalFilename",
  "peopleInvolved",
  "redactions",
  "sha256",
  "tags",
];

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

function uniqueFields(fields: ProofVaultSourceField[]): ProofVaultSourceField[] {
  return [...new Set(fields)].sort((left, right) => left.localeCompare(right));
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

function resolvePolicyId(mode: ExportBundle["mode"], includeAttachments: boolean): ProofVaultRedactionPolicy["id"] {
  if (mode === "redacted" || !includeAttachments) {
    return "minimal";
  }

  return "full";
}

export function createProofVaultRedactionPolicy(options: {
  mode: ExportBundle["mode"];
  includeAttachments: boolean;
  includeMetadataAppendix: boolean;
}): ProofVaultRedactionPolicy {
  const id = resolvePolicyId(options.mode, options.includeAttachments);

  if (id === "minimal") {
    return {
      id,
      mode: options.mode,
      label: "Minimal",
      omittedFields: [...MINIMAL_POLICY_OMISSIONS],
      includeAttachments: options.includeAttachments,
      includeMetadataAppendix: options.includeMetadataAppendix,
    };
  }

  return {
    id,
    mode: options.mode,
    label: "Full",
    omittedFields: [],
    includeAttachments: options.includeAttachments,
    includeMetadataAppendix: options.includeMetadataAppendix,
  };
}

export async function buildProofVaultEvidenceRecord(input: {
  item: EvidenceItem;
  exportTimestamp: string;
  outputFormat: ProofVaultExportFormat;
  redactionPolicy: ProofVaultRedactionPolicy;
}): Promise<ProofVaultEvidenceRecord> {
  const sourceSnapshot = buildSourceSnapshot(input.item);
  const omittedFields = uniqueFields([
    ...input.redactionPolicy.omittedFields,
    ...(input.redactionPolicy.includeAttachments ? [] : (["attachment", "originalFilename", "sha256"] satisfies ProofVaultSourceField[])),
    ...(input.item.redactions && input.item.redactions.length > 0 ? (["redactions"] satisfies ProofVaultSourceField[]) : []),
  ]);

  const encryptedPayloadRef = input.item.encryptedPayload ? await hashValue(input.item.encryptedPayload) : null;
  const attachmentRef = input.item.sha256 ?? null;
  const sourceSnapshotRef = await hashValue(sourceSnapshot);
  const integrityRef = await hashValue({
    sourceId: input.item.id,
    encryptedPayloadRef,
    attachmentRef,
    sourceSnapshotRef,
  });

  const integritySeal = await hashValue({
    sourceId: input.item.id,
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
    sourceId: input.item.id,
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
  caseFile: CaseFile;
  caseId?: string;
  items?: EvidenceItem[];
  exportTimestamp: string;
  outputFormat: ProofVaultExportFormat;
  redactionPolicy: ProofVaultRedactionPolicy;
  evidenceRecords: ProofVaultEvidenceRecord[];
}): Promise<string> {
  return hashValue({
    caseId: input.caseId ?? input.caseFile.id,
    exportTimestamp: input.exportTimestamp,
    outputFormat: input.outputFormat,
    redactionPolicy: input.redactionPolicy,
    evidenceRecords: input.evidenceRecords,
  });
}