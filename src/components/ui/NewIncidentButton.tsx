import { Link } from "react-router-dom";

export function NewIncidentButton() {
  return (
    <Link
      to="/incidents/new"
      className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
    >
      New Incident
    </Link>
  );
}
