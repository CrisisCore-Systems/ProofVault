import type { EvidenceItem } from "../../domain/types";
import { createEvidenceItem } from "../../db/queries";
import type { IncidentFormValues } from "./incidentForm";
import { parseCommaSeparatedList, validateIncidentForm } from "./incidentValidators";

function toIsoFromLocalDateTime(value: string): string {
  return new Date(value).toISOString();
}

function normalizeTags(baseTags: string, urgency: boolean): string[] {
  const parsedTags = parseCommaSeparatedList(baseTags);

  if (!urgency) {
    return parsedTags;
  }

  if (parsedTags.some((tag) => tag.toLowerCase() === "urgent")) {
    return parsedTags;
  }

  return ["urgent", ...parsedTags];
}

export async function saveIncident(values: IncidentFormValues): Promise<{ id: string }> {
  const result = validateIncidentForm(values);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid incident input");
  }

  const parsedPeople = parseCommaSeparatedList(values.peopleInvolved);
  const parsedTags = normalizeTags(values.tags, values.urgency);

  const nowIso = new Date().toISOString();

  const item: EvidenceItem = {
    id: crypto.randomUUID(),
    caseId: values.caseId || undefined,
    kind: "incident",
    title: values.title.trim(),
    description: values.description?.trim() || undefined,
    occurredAt: values.occurredAt ? toIsoFromLocalDateTime(values.occurredAt) : undefined,
    recordedAt: values.recordedAt ? toIsoFromLocalDateTime(values.recordedAt) : nowIso,
    importedAt: undefined,
    locationText: values.locationText?.trim() || undefined,
    peopleInvolved: parsedPeople.length ? parsedPeople : undefined,
    tags: parsedTags.length ? parsedTags : undefined,
    fileRef: undefined,
    originalFilename: undefined,
    mimeType: undefined,
    sha256: undefined,
    includeInExport: true,
    redactionStatus: "none",
    dateCertainty: values.occurredAt ? "exact" : "unknown",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await createEvidenceItem(item);

  return { id: item.id };
}
