import { z } from "zod";
import type { IncidentFormValues } from "./incidentForm";

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const IncidentFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(160, "Title must be 160 characters or fewer"),
  recordedAt: z
    .string()
    .trim()
    .min(1, "Recorded date and time is required")
    .regex(DATETIME_LOCAL_PATTERN, "Recorded date and time is invalid"),
  occurredAt: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || DATETIME_LOCAL_PATTERN.test(value), {
      message: "Occurred date and time is invalid",
    }),
  locationText: z.string().trim().max(200, "Location must be 200 characters or fewer").optional(),
  peopleInvolved: z.string().trim().max(500, "People field is too long").optional(),
  description: z.string().trim().max(5000, "Description is too long").optional(),
  caseId: z.string().trim().optional(),
  tags: z.string().trim().max(500, "Tags field is too long").optional(),
  urgency: z.boolean(),
});

export function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function validateIncidentForm(values: IncidentFormValues) {
  return IncidentFormSchema.safeParse(values);
}
