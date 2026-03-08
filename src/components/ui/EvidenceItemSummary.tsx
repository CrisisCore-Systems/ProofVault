import { Link } from "react-router-dom";
import type { EvidenceItem } from "../../domain/types";
import { formatDisplayDateTime } from "../../lib/dates/format";

type EvidenceItemSummaryProps = {
  item: EvidenceItem;
};

function hashSnippet(hash: string): string {
  return `${hash.slice(0, 12)}...`;
}

export function EvidenceItemSummary({ item }: Readonly<EvidenceItemSummaryProps>) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-zinc-100">
        <Link to={`/evidence/${item.id}`} className="hover:text-emerald-300">
          {item.title}
        </Link>
      </h3>
      <p className="text-xs text-zinc-400">
        {item.kind} · linked case: {item.caseId ?? "unassigned"}
      </p>

      {item.fileRef ? (
        <div className="space-y-1 text-xs text-zinc-400">
          {item.originalFilename ? <p>filename: {item.originalFilename}</p> : null}
          {item.mimeType ? <p>type: {item.mimeType}</p> : null}
          {item.importedAt ? <p>imported: {formatDisplayDateTime(item.importedAt)}</p> : null}
          {item.sha256 ? <p>hash: {hashSnippet(item.sha256)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
