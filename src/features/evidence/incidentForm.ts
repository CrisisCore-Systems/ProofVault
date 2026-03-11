import { format } from "date-fns";

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
    recordedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    occurredAt: "",
    locationText: "",
    peopleInvolved: "",
    description: "",
    caseId: "",
    tags: "",
    urgency: false,
  };
}
