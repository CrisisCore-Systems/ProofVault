import { Link } from "react-router-dom";

export function AddAttachmentButton() {
  return (
    <Link
      to="/attachments/new"
      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
    >
      Add Attachment
    </Link>
  );
}
