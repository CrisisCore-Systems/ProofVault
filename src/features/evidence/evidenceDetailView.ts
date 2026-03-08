import type { AttachmentRecord, CaseFile, EvidenceItem } from "../../domain/types";

export type EvidenceDetailView = {
  evidence: EvidenceItem;
  attachment?: AttachmentRecord;
  caseFile?: CaseFile;
  linkedIncident?: EvidenceItem;
};
