import { useState, type SyntheticEvent } from "react";
import { useVault } from "./VaultContext";

export function VaultLockScreen() {
  const { unlock } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setUnlocking(true);

    try {
      const ok = await unlock(passphrase);
      if (!ok) {
        setError("Incorrect passphrase. Please try again.");
      }
    } catch {
      setError("Failed to unlock vault. Please try again.");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-zinc-100">Vault Locked</h1>
          <p className="text-sm text-zinc-400">
            Enter your passphrase to unlock ProofVault and access your encrypted evidence.
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Passphrase *</span>
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            />
          </label>

          {error ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={unlocking}
            className="w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {unlocking ? "Unlocking…" : "Unlock Vault"}
          </button>
        </form>
      </div>
    </div>
  );
}
