import { describe, expect, it } from "vitest";
import { CaseFileSchema, EvidenceItemSchema } from "./validators";

const BASE_CASE = {
  id: "case-1",
  type: "housing" as const,
  status: "active" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const BASE_EVIDENCE = {
  id: "ev-1",
  kind: "note" as const,
  recordedAt: "2026-01-01T00:00:00.000Z",
  includeInExport: true,
  redactionStatus: "none" as const,
  dateCertainty: "exact" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("CaseFileSchema.title", () => {
  it("accepts a normal title string", () => {
    const result = CaseFileSchema.safeParse({ ...BASE_CASE, title: "Tenant Dispute" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = CaseFileSchema.safeParse({ ...BASE_CASE, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only title (spaces only)", () => {
    const result = CaseFileSchema.safeParse({ ...BASE_CASE, title: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only title (tabs and newlines)", () => {
    const result = CaseFileSchema.safeParse({ ...BASE_CASE, title: "\t\n  " });
    expect(result.success).toBe(false);
  });

  it("accepts a title that has surrounding whitespace (trimmed to non-empty)", () => {
    const result = CaseFileSchema.safeParse({ ...BASE_CASE, title: "  Real Title  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Real Title");
    }
  });
});

describe("EvidenceItemSchema.title", () => {
  it("accepts a normal title string", () => {
    const result = EvidenceItemSchema.safeParse({ ...BASE_EVIDENCE, title: "Witnessed altercation" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = EvidenceItemSchema.safeParse({ ...BASE_EVIDENCE, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    const result = EvidenceItemSchema.safeParse({ ...BASE_EVIDENCE, title: "   " });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from a valid title", () => {
    const result = EvidenceItemSchema.safeParse({ ...BASE_EVIDENCE, title: "  Note content  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Note content");
    }
  });
});
