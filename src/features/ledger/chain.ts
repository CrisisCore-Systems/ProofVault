import type { LedgerEntry } from "../../domain/types";
import { appendLedgerEntry, getLatestLedgerEntry, listLedgerEntries } from "../../db/queries";
import { sha256HexFromText } from "../../lib/hashing/sha256";

type LedgerEventInput = {
  event: string;
  caseId?: string;
  attachmentId?: string;
  data?: Record<string, unknown>;
};

async function computeLedgerHash(payload: {
  timestamp: string;
  event: string;
  caseId?: string;
  attachmentId?: string;
  data?: Record<string, unknown>;
  prevHash?: string;
}): Promise<string> {
  const canonicalPayload = JSON.stringify(payload);
  return sha256HexFromText(canonicalPayload);
}

export async function appendLedgerEvent(input: LedgerEventInput): Promise<LedgerEntry> {
  const latest = await getLatestLedgerEntry();
  const timestamp = new Date().toISOString();

  const hash = await computeLedgerHash({
    timestamp,
    event: input.event,
    caseId: input.caseId,
    attachmentId: input.attachmentId,
    data: input.data,
    prevHash: latest?.hash,
  });

  const entry: LedgerEntry = {
    id: crypto.randomUUID(),
    timestamp,
    event: input.event,
    caseId: input.caseId,
    attachmentId: input.attachmentId,
    data: input.data,
    prevHash: latest?.hash,
    hash,
  };

  await appendLedgerEntry(entry);
  return entry;
}

export type LedgerVerificationResult = {
  ok: boolean;
  checkedEntries: number;
  error?: string;
};

export async function verifyLedgerChain(): Promise<LedgerVerificationResult> {
  const entries = await listLedgerEntries();

  if (entries.length === 0) {
    return { ok: true, checkedEntries: 0 };
  }

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const expectedHash = await computeLedgerHash({
      timestamp: entry.timestamp,
      event: entry.event,
      caseId: entry.caseId,
      attachmentId: entry.attachmentId,
      data: entry.data,
      prevHash: entry.prevHash,
    });

    if (entry.hash !== expectedHash) {
      return {
        ok: false,
        checkedEntries: index + 1,
        error: `Ledger hash mismatch at entry ${entry.id}`,
      };
    }

    if (index > 0) {
      const previousEntry = entries[index - 1];
      if (entry.prevHash !== previousEntry.hash) {
        return {
          ok: false,
          checkedEntries: index + 1,
          error: `Ledger chain broken between ${previousEntry.id} and ${entry.id}`,
        };
      }
    }
  }

  return {
    ok: true,
    checkedEntries: entries.length,
  };
}

export type LedgerHealth = {
  chainValid: boolean;
  entries: number;
  lastEventAt?: string;
  vaultRootHash?: string;
  error?: string;
};

function hashSnippet(hash?: string): string | undefined {
  if (!hash) {
    return undefined;
  }

  if (hash.length <= 24) {
    return hash;
  }

  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

export async function getLedgerHealth(): Promise<LedgerHealth> {
  const verification = await verifyLedgerChain();
  const latest = await getLatestLedgerEntry();

  if (!latest) {
    return {
      chainValid: verification.ok,
      entries: 0,
      lastEventAt: undefined,
      vaultRootHash: undefined,
      error: verification.error,
    };
  }

  const fullVaultRootHash = await sha256HexFromText(latest.hash);

  return {
    chainValid: verification.ok,
    entries: verification.checkedEntries,
    lastEventAt: latest.timestamp,
    vaultRootHash: hashSnippet(fullVaultRootHash),
    error: verification.error,
  };
}
