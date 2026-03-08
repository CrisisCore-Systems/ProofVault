export type IncidentFormValues = {
  title: string;
  recordedAt: string;
  occurredAt: string;
  locationText: string;
  peopleInvolved: string;
  description: string;
  caseId: string;
  tags: string;
  urgency: boolean;
};

export function defaultIncidentFormValues(): IncidentFormValues {
  const now = new Date();
  const localValue = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return {
    title: "",
    recordedAt: localValue,
    occurredAt: "",
    locationText: "",
    peopleInvolved: "",
    description: "",
    caseId: "",
    tags: "",
    urgency: false,
  };
}
