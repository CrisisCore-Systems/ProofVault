import { buildCrossCheckFingerprint, shortFingerprint } from "../../../lib/export/integrityFingerprints";

type CompactIntegrityHeaderProps = {
  manifestSeal: string;
  reportSha256: string;
};

export function CompactIntegrityHeader({
  manifestSeal,
  reportSha256,
}: Readonly<CompactIntegrityHeaderProps>) {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200/80">Security fingerprint</p>
          <p className="mt-1 text-amber-100">
            Compare this block against the printed certificate or JSON report before relying on a shared export.
          </p>
        </div>
        <p className="rounded-full border border-amber-400/30 px-2 py-1 font-mono text-[11px] text-amber-100">
          {buildCrossCheckFingerprint(manifestSeal, reportSha256)}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-amber-400/20 bg-black/10 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-amber-200/70">Manifest seal</p>
          <p className="mt-1 font-mono text-sm text-amber-50">{shortFingerprint(manifestSeal, 4, 5)}</p>
        </div>
        <div className="rounded-md border border-amber-400/20 bg-black/10 px-3 py-2">
          <p className="text-[11px] uppercase tracking-widest text-amber-200/70">Report checksum</p>
          <p className="mt-1 font-mono text-sm text-amber-50">{shortFingerprint(reportSha256, 4, 5)}</p>
        </div>
      </div>
    </div>
  );
}