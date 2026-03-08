import { z } from "zod";

export const CaseFileSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["housing", "work", "legal", "medical", "family", "other"]),
  description: z.string().optional(),
  status: z.enum(["active", "archived", "draft"]),
  lastVerifiedAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const RedactionRegionSchema = z.object({
  id: z.string().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
}).superRefine((value, ctx) => {
  if (value.x + value.width > 100) {
    ctx.addIssue({
      code: "custom",
      message: "Redaction width exceeds image bounds",
      path: ["width"],
    });
  }

  if (value.y + value.height > 100) {
    ctx.addIssue({
      code: "custom",
      message: "Redaction height exceeds image bounds",
      path: ["height"],
    });
  }
});

export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1).optional(),
  kind: z.enum(["incident", "photo", "screenshot", "pdf", "audio", "note"]),
  title: z.string().min(1),
  description: z.string().optional(),
  occurredAt: z.iso.datetime().optional(),
  recordedAt: z.iso.datetime(),
  importedAt: z.iso.datetime().optional(),
  locationText: z.string().optional(),
  peopleInvolved: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  fileRef: z.string().optional(),
  originalFilename: z.string().optional(),
  mimeType: z.string().optional(),
  sha256: z.string().optional(),
  redactions: z.array(RedactionRegionSchema).optional(),
  includeInExport: z.boolean(),
  redactionStatus: z.enum(["none", "partial", "full"]),
  dateCertainty: z.enum(["exact", "approximate", "unknown"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ExportBundleSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  mode: z.enum(["full", "redacted"]),
  createdAt: z.iso.datetime(),
  itemIds: z.array(z.string()).min(1),
  manifestRef: z.string().min(1),
  archiveRef: z.string().optional(),
});

export const AttachmentRecordSchema = z.object({
  id: z.string().min(1),
  evidenceItemId: z.string().min(1),
  blob: z.instanceof(Blob),
  sizeBytes: z.number().nonnegative(),
  mimeType: z.string().min(1),
  originalFilename: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});

export const AttachmentEvidenceLinkSchema = z.object({
  attachmentId: z.string().min(1),
  evidenceItemId: z.string().min(1),
});

export const LedgerEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.iso.datetime(),
  event: z.string().min(1),
  caseId: z.string().optional(),
  attachmentId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  prevHash: z.string().optional(),
  hash: z.string().min(1),
});
