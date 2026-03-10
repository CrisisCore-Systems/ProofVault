import { Link, useNavigate } from "react-router-dom";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useNewIncident } from "../../features/evidence/useNewIncident";

export function NewIncident() {
  const navigate = useNavigate();
  const { values, cases, errorMessage, saving, setField, handleSubmit } = useNewIncident(navigate);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <SectionHeader
        title="New Incident"
        subtitle="Capture what happened quickly and store it locally"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="pv-card space-y-3">
          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Title *</span>
            <input
              value={values.title}
              onChange={(event) => setField("title", event.target.value)}
              placeholder="What happened?"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 placeholder:text-zinc-500 focus:ring"
              maxLength={160}
              required
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Recorded At *</span>
            <input
              type="datetime-local"
              value={values.recordedAt}
              onChange={(event) => setField("recordedAt", event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
              required
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Occurred At</span>
            <input
              type="datetime-local"
              value={values.occurredAt}
              onChange={(event) => setField("occurredAt", event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Location</span>
            <input
              value={values.locationText}
              onChange={(event) => setField("locationText", event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">People Involved</span>
            <input
              value={values.peopleInvolved}
              onChange={(event) => setField("peopleInvolved", event.target.value)}
              placeholder="Comma-separated names"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 placeholder:text-zinc-500 focus:ring"
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Case</span>
            <select
              value={values.caseId}
              onChange={(event) => setField("caseId", event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            >
              <option value="">Unassigned</option>
              {cases.map((caseItem) => (
                <option key={caseItem.id} value={caseItem.id}>
                  {caseItem.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Tags</span>
            <input
              value={values.tags}
              onChange={(event) => setField("tags", event.target.value)}
              placeholder="Comma-separated tags"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 placeholder:text-zinc-500 focus:ring"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={values.urgency}
              onChange={(event) => setField("urgency", event.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
            />
            <span>Urgency</span>
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Description</span>
            <textarea
              value={values.description}
              onChange={(event) => setField("description", event.target.value)}
              rows={6}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            />
          </label>

          {errorMessage ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Incident"}
            </button>

            <Link
              to="/inbox"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </section>
  );
}
