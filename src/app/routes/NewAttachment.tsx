import { Link, useNavigate } from "react-router-dom";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useNewAttachment } from "../../features/evidence/useNewAttachment";

export function NewAttachment() {
  const navigate = useNavigate();
  const { values, selectedFile, cases, errorMessage, saving, setField, handleFileChange, handleSubmit } =
    useNewAttachment(navigate);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <SectionHeader
        title="Add Attachment"
        subtitle="Store one file locally with metadata and SHA-256 integrity hash"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="pv-card space-y-3">
          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">File *</span>
            <input
              type="file"
              accept="image/*,application/pdf,audio/*"
              onChange={handleFileChange}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-200"
              required
            />
          </label>

          {selectedFile ? (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
              <p>Filename: {selectedFile.name}</p>
              <p>MIME: {selectedFile.type || "unknown"}</p>
              <p>Size: {selectedFile.size} bytes</p>
            </div>
          ) : null}

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Title *</span>
            <input
              value={values.title}
              onChange={(event) => setField("title", event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
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
            <span className="mb-1 block">Description</span>
            <textarea
              value={values.description}
              onChange={(event) => setField("description", event.target.value)}
              rows={5}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            />
          </label>

          {errorMessage ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {errorMessage}
            </p>
          ) : null}

          {saving ? (
            <p className="text-sm text-zinc-300">Hashing file and saving locally...</p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Attachment"}
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
