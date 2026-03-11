import { z } from "zod";
import { nowAsLocalDateTimeString } from "../../lib/dates/format";

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type AttachmentFormValues = {
  title: string;
  description: string;
  caseId: string;
  recordedAt: string;
};

export function defaultAttachmentFormValues(): AttachmentFormValues {
  return {
    title: "",
    description: "",
    caseId: "",
    recordedAt: nowAsLocalDateTimeString(),
  };
}

export const AttachmentFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(160, "Title must be 160 characters or fewer"),
  description: z.string().trim().max(5000, "Description is too long").optional(),
  caseId: z.string().trim().optional(),
  recordedAt: z
    .string()
    .trim()
    .min(1, "Recorded date and time is required")
    .regex(DATETIME_LOCAL_PATTERN, "Recorded date and time is invalid"),
});

export function validateAttachmentForm(values: AttachmentFormValues) {
  return AttachmentFormSchema.safeParse(values);
}
