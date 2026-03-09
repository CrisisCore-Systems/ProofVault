import { useState, type SyntheticEvent } from "react";
import { useVault } from "./VaultContext";

export function VaultSetupScreen() {
  const { setupVault } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }

    if (passphrase !== confirm) {
      setError("Passphrases do not match.");
      return;
    }

    setSaving(true);
    try {
      await setupVault(passphrase);
    } catch {
      setError("Failed to set up vault. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-zinc-100">Set Up Vault Encryption</h1>
          <p className="text-sm text-zinc-400">
            Choose a passphrase to encrypt your attachments locally. This passphrase is never sent
            anywhere — it only exists on your device.
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Passphrase *</span>
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
            />
          </label>

          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Confirm Passphrase *</span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
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
            disabled={saving}
            className="w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Setting up vault…" : "Create Vault"}
          </button>
        </form>

        <p className="text-xs text-zinc-500">
          Your passphrase cannot be recovered. If you lose it, your encrypted attachments cannot be
          decrypted.
        </p>
      </div>
    </div>
  );
}
