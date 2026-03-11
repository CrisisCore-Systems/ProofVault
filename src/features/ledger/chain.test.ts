import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LedgerEntry } from "../../domain/types";
import { sha256HexFromText } from "../../lib/hashing/sha256";
import { appendLedgerEvent, getLedgerHealth, verifyLedgerChain } from "./chain";

const { appendLedgerEntryMock, getLatestLedgerEntryMock, listLedgerEntriesMock } = vi.hoisted(() => ({
  appendLedgerEntryMock: vi.fn(),
  getLatestLedgerEntryMock: vi.fn(),
  listLedgerEntriesMock: vi.fn(),
}));

vi.mock("../../db/queries", () => ({
  appendLedgerEntry: appendLedgerEntryMock,
  getLatestLedgerEntry: getLatestLedgerEntryMock,
  listLedgerEntries: listLedgerEntriesMock,
}));

async function makeEntry(
  overrides: Partial<LedgerEntry> & Pick<LedgerEntry, "id" | "timestamp" | "event">
): Promise<LedgerEntry> {
  const partial: LedgerEntry = {
    caseId: undefined,
    attachmentId: undefined,
    data: undefined,
    prevHash: undefined,
    hash: "",
    ...overrides,
  };
  const hash = await sha256HexFromText(
    JSON.stringify({
      timestamp: partial.timestamp,
      event: partial.event,
      caseId: partial.caseId,
      attachmentId: partial.attachmentId,
      data: partial.data,
      prevHash: partial.prevHash,
    })
  );
  return { ...partial, hash };
}

describe("ledger chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendLedgerEntryMock.mockResolvedValue(undefined);
    getLatestLedgerEntryMock.mockResolvedValue(null);
    listLedgerEntriesMock.mockResolvedValue([]);
  });

  describe("appendLedgerEvent", () => {
    it("appends a first event with no prevHash", async () => {
      getLatestLedgerEntryMock.mockResolvedValue(null);

      const result = await appendLedgerEvent({ event: "CASE_CREATED", caseId: "case-1" });

      expect(result.event).toBe("CASE_CREATED");
      expect(result.caseId).toBe("case-1");
      expect(result.prevHash).toBeUndefined();
      expect(result.hash).toBeTruthy();
      expect(appendLedgerEntryMock).toHaveBeenCalledWith(result);
    });

    it("links subsequent event to the previous entry hash", async () => {
      const previousEntry: LedgerEntry = {
        id: "prev-id",
        timestamp: "2026-01-01T00:00:00.000Z",
        event: "PREVIOUS_EVENT",
        hash: "abc123deadbeef",
      };
      getLatestLedgerEntryMock.mockResolvedValue(previousEntry);

      const result = await appendLedgerEvent({ event: "NEXT_EVENT" });

      expect(result.prevHash).toBe("abc123deadbeef");
    });

    it("stores the correct hash for the payload fields", async () => {
      getLatestLedgerEntryMock.mockResolvedValue(null);

      const result = await appendLedgerEvent({
        event: "ATTACHMENT_ADDED",
        attachmentId: "att-1",
        data: { sizeBytes: 512 },
      });

      const expectedHash = await sha256HexFromText(
        JSON.stringify({
          timestamp: result.timestamp,
          event: "ATTACHMENT_ADDED",
          caseId: undefined,
          attachmentId: "att-1",
          data: { sizeBytes: 512 },
          prevHash: undefined,
        })
      );

      expect(result.hash).toBe(expectedHash);
    });
  });

  describe("verifyLedgerChain", () => {
    it("returns ok with 0 checked entries for an empty chain", async () => {
      listLedgerEntriesMock.mockResolvedValue([]);

      const result = await verifyLedgerChain();

      expect(result.ok).toBe(true);
      expect(result.checkedEntries).toBe(0);
    });

    it("validates a single-entry chain with a correct hash", async () => {
      const entry = await makeEntry({ id: "e1", timestamp: "2026-01-01T00:00:00.000Z", event: "TEST" });
      listLedgerEntriesMock.mockResolvedValue([entry]);

      const result = await verifyLedgerChain();

      expect(result.ok).toBe(true);
      expect(result.checkedEntries).toBe(1);
    });

    it("detects a tampered entry hash", async () => {
      const entry = await makeEntry({ id: "e1", timestamp: "2026-01-01T00:00:00.000Z", event: "TEST" });
      const tampered = { ...entry, hash: "000000000000000000000000000000000000000000000000000000000000dead" };
      listLedgerEntriesMock.mockResolvedValue([tampered]);

      const result = await verifyLedgerChain();

      expect(result.ok).toBe(false);
      expect(result.error).toContain(tampered.id);
    });

    it("validates a valid two-entry chain", async () => {
      const entry1 = await makeEntry({ id: "e1", timestamp: "2026-01-01T00:00:00.000Z", event: "FIRST" });
      const entry2 = await makeEntry({
        id: "e2",
        timestamp: "2026-01-02T00:00:00.000Z",
        event: "SECOND",
        prevHash: entry1.hash,
      });
      listLedgerEntriesMock.mockResolvedValue([entry1, entry2]);

      const result = await verifyLedgerChain();

      expect(result.ok).toBe(true);
      expect(result.checkedEntries).toBe(2);
    });

    it("detects a broken chain link between entries", async () => {
      const entry1 = await makeEntry({ id: "e1", timestamp: "2026-01-01T00:00:00.000Z", event: "FIRST" });
      const entry2 = await makeEntry({
        id: "e2",
        timestamp: "2026-01-02T00:00:00.000Z",
        event: "SECOND",
        prevHash: "wrong-prev-hash",
      });
      listLedgerEntriesMock.mockResolvedValue([entry1, entry2]);

      const result = await verifyLedgerChain();

      expect(result.ok).toBe(false);
      expect(result.error).toContain(entry1.id);
      expect(result.error).toContain(entry2.id);
    });
  });

  describe("getLedgerHealth", () => {
    it("returns empty state when no entries exist", async () => {
      listLedgerEntriesMock.mockResolvedValue([]);
      getLatestLedgerEntryMock.mockResolvedValue(null);

      const result = await getLedgerHealth();

      expect(result.chainValid).toBe(true);
      expect(result.entries).toBe(0);
      expect(result.lastEventAt).toBeUndefined();
      expect(result.vaultRootHash).toBeUndefined();
    });

    it("returns chain health info with a truncated vault root hash", async () => {
      const entry = await makeEntry({ id: "e1", timestamp: "2026-01-15T10:00:00.000Z", event: "TEST" });
      listLedgerEntriesMock.mockResolvedValue([entry]);
      getLatestLedgerEntryMock.mockResolvedValue(entry);

      const result = await getLedgerHealth();

      expect(result.chainValid).toBe(true);
      expect(result.entries).toBe(1);
      expect(result.lastEventAt).toBe("2026-01-15T10:00:00.000Z");
      expect(result.vaultRootHash).toMatch(/^[0-9a-f]{12}\.\.\.[0-9a-f]{8}$/);
    });

    it("reports chain as invalid when an entry hash is tampered", async () => {
      const entry = await makeEntry({ id: "e1", timestamp: "2026-01-01T00:00:00.000Z", event: "TEST" });
      const tampered = { ...entry, hash: "badhash" };
      listLedgerEntriesMock.mockResolvedValue([tampered]);
      getLatestLedgerEntryMock.mockResolvedValue(tampered);

      const result = await getLedgerHealth();

      expect(result.chainValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
