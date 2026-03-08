import { useState } from "react";
import { seedDemoData } from "../../db/seeds";

type SeedDataButtonProps = {
  onSeeded: () => Promise<void>;
};

export function SeedDataButton({ onSeeded }: Readonly<SeedDataButtonProps>) {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    await seedDemoData();
    await onSeeded();
    setLoading(false);
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleSeed}
      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Seeding..." : "Seed Test Data"}
    </button>
  );
}
