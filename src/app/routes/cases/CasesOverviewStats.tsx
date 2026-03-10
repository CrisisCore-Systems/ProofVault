import { formatDisplayDateTime } from "../../../lib/dates/format";
import type { LedgerHealth } from "../../../features/ledger/chain";

type CasesOverviewStatsProps = {
  caseCount: number;
  totalEvidenceFiles: number;
  verificationCurrentCases: number;
  staleCaseCount: number;
  mismatchCount: number;
  ledgerHealth: LedgerHealth | null;
};

function ledgerStatusLabel(ledgerHealth: LedgerHealth | null): string {
  if (!ledgerHealth) {
    return "Checking...";
  }

  return ledgerHealth.chainValid ? "✓ Chain Valid" : "⚠ Integrity Error";
}

function StatCard({ label, value, valueClassName = "text-zinc-100" }: Readonly<{
  label: string;
  value: number;
  valueClassName?: string;
}>) {
  return (
    <div className="pv-card">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={["mt-1 text-lg font-semibold", valueClassName].join(" ")}>{value}</p>
    </div>
  );
}

export function CasesOverviewStats({
  caseCount,
  totalEvidenceFiles,
  verificationCurrentCases,
  staleCaseCount,
  mismatchCount,
  ledgerHealth,
}: Readonly<CasesOverviewStatsProps>) {
  return (
    <section className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      <StatCard label="Cases" value={caseCount} />
      <StatCard label="Evidence Files" value={totalEvidenceFiles} />
      <StatCard
        label="Verification Current"
        value={verificationCurrentCases}
        valueClassName="text-emerald-300"
      />
      <StatCard label="Stale" value={staleCaseCount} valueClassName="text-amber-300" />
      <StatCard label="Mismatch (latest run)" value={mismatchCount} valueClassName="text-red-300" />

      <div className="pv-card">
        <p className="text-xs text-zinc-400">Vault Ledger</p>
        <p
          className={[
            "mt-1 text-sm font-semibold",
            ledgerHealth?.chainValid ? "text-emerald-300" : "text-amber-300",
          ].join(" ")}
        >
          {ledgerStatusLabel(ledgerHealth)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Entries: {ledgerHealth?.entries ?? 0}</p>
        {ledgerHealth?.lastEventAt ? (
          <p className="text-xs text-zinc-500">Last: {formatDisplayDateTime(ledgerHealth.lastEventAt)}</p>
        ) : null}
        {ledgerHealth?.vaultRootHash ? (
          <p className="text-xs text-zinc-500">Root: {ledgerHealth.vaultRootHash}</p>
        ) : null}
      </div>
    </section>
  );
}