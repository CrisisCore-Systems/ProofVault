import { nowAsLocalDateTimeString } from "../../lib/dates/format";

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
  return {
    title: "",
    recordedAt: nowAsLocalDateTimeString(),
    occurredAt: "",
    locationText: "",
    peopleInvolved: "",
    description: "",
    caseId: "",
    tags: "",
    urgency: false,
  };
}
