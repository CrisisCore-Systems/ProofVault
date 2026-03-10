import type { CaseFile, EncryptedPayload, EvidenceItem } from "../../domain/types";
import { decryptJson, encryptJson } from "./crypto";
import { getSessionKeyOrThrow } from "./session";

type CaseSensitiveFields = {
  description?: string;
};

type EvidenceSensitiveFields = {
  description?: string;
  locationText?: string;
  peopleInvolved?: string[];
  tags?: string[];
};

function hasEncryptedPayload(payload?: EncryptedPayload): payload is EncryptedPayload {
  return Boolean(payload?.ciphertext && payload.iv);
}

function hasMeaningfulValues(values: Record<string, unknown>): boolean {
  return Object.values(values).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== undefined && value !== "";
  });
}

export async function encryptCaseFileForStorageWithKey(caseFile: CaseFile, key: CryptoKey): Promise<CaseFile> {
  const sensitive: CaseSensitiveFields = {
    description: caseFile.description,
  };

  if (!hasMeaningfulValues(sensitive)) {
    return {
      ...caseFile,
      encryptedPayload: undefined,
    };
  }

  const encryptedPayload = await encryptJson(sensitive, key);

  return {
    ...caseFile,
    description: undefined,
    encryptedPayload,
  };
}

export async function encryptCaseFileForStorage(caseFile: CaseFile): Promise<CaseFile> {
  return encryptCaseFileForStorageWithKey(caseFile, getSessionKeyOrThrow());
}

export async function decryptCaseFileFromStorageWithKey(caseFile: CaseFile, key: CryptoKey): Promise<CaseFile> {
  if (!hasEncryptedPayload(caseFile.encryptedPayload)) {
    return caseFile;
  }

  const decrypted = await decryptJson<CaseSensitiveFields>(caseFile.encryptedPayload, key);

  return {
    ...caseFile,
    ...decrypted,
  };
}

export async function decryptCaseFileFromStorage(caseFile: CaseFile): Promise<CaseFile> {
  return decryptCaseFileFromStorageWithKey(caseFile, getSessionKeyOrThrow());
}

export async function encryptEvidenceItemForStorageWithKey(
  evidenceItem: EvidenceItem,
  key: CryptoKey
): Promise<EvidenceItem> {
  const sensitive: EvidenceSensitiveFields = {
    description: evidenceItem.description,
    locationText: evidenceItem.locationText,
    peopleInvolved: evidenceItem.peopleInvolved,
    tags: evidenceItem.tags,
  };

  if (!hasMeaningfulValues(sensitive)) {
    return {
      ...evidenceItem,
      encryptedPayload: undefined,
    };
  }

  const encryptedPayload = await encryptJson(sensitive, key);

  return {
    ...evidenceItem,
    description: undefined,
    locationText: undefined,
    peopleInvolved: undefined,
    tags: undefined,
    encryptedPayload,
  };
}

export async function encryptEvidenceItemForStorage(evidenceItem: EvidenceItem): Promise<EvidenceItem> {
  return encryptEvidenceItemForStorageWithKey(evidenceItem, getSessionKeyOrThrow());
}

export async function decryptEvidenceItemFromStorageWithKey(
  evidenceItem: EvidenceItem,
  key: CryptoKey
): Promise<EvidenceItem> {
  if (!hasEncryptedPayload(evidenceItem.encryptedPayload)) {
    return evidenceItem;
  }

  const decrypted = await decryptJson<EvidenceSensitiveFields>(evidenceItem.encryptedPayload, key);

  return {
    ...evidenceItem,
    ...decrypted,
  };
}

export async function decryptEvidenceItemFromStorage(evidenceItem: EvidenceItem): Promise<EvidenceItem> {
  return decryptEvidenceItemFromStorageWithKey(evidenceItem, getSessionKeyOrThrow());
}