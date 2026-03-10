import { Link } from "react-router-dom";
import type { EvidenceItem } from "../../../domain/types";
import type { EvidenceDetailView } from "../../../features/evidence/evidenceDetailView";

type RelationshipsSectionProps = {
  caseFile?: EvidenceDetailView["caseFile"];
  linkedIncident?: EvidenceItem;
  attachment?: EvidenceDetailView["attachment"];
};

export function RelationshipsSection({ caseFile, linkedIncident, attachment }: Readonly<RelationshipsSectionProps>) {
  return (
    <section className="pv-card space-y-3">
      <h3 className="pv-section-title">Relationships</h3>
      <p className="text-sm text-zinc-300">
        Case:{" "}
        {caseFile ? (
          <Link to="/cases" className="text-emerald-300 hover:text-emerald-200">
            {caseFile.title}
          </Link>
        ) : (
          "unassigned"
        )}
      </p>
      <p className="text-sm text-zinc-300">
        Linked Incident:{" "}
        {linkedIncident ? (
          <Link to={`/evidence/${linkedIncident.id}`} className="text-emerald-300 hover:text-emerald-200">
            {linkedIncident.title}
          </Link>
        ) : (
          "not linked"
        )}
      </p>
      {attachment ? <p className="text-xs text-zinc-500">Attachment ID: {attachment.id}</p> : null}
    </section>
  );
}