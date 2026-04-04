import {
  createContext,
  type ComponentProps,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import {
  getSecurityPreferences,
  hasConfiguredAppLock,
  initializeAppLock,
  isSessionUnlocked,
  lockSession,
  type SecurityPreferences,
  subscribeToSessionState,
  unlockSession,
  updateSecurityPreferences,
} from "./session";
import { buildPassphrasePolicyFeedback } from "./passphrasePolicy";
import { migrateExistingSensitiveData } from "./migration";
import { rotatePassphrase as rotatePassphraseForVault } from "./rotation";

type AppLockStatus = "setup" | "locked" | "unlocked";

type AppLockContextValue = {
  status: AppLockStatus;
  busy: boolean;
  lock: () => void;
  idleTimeoutMinutes: number;
  lockOnHidden: boolean;
  setIdleTimeoutMinutes: (minutes: number) => void;
  setLockOnHidden: (value: boolean) => void;
  rotatePassphrase: (currentPassphrase: string, nextPassphrase: string) => Promise<void>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

function getIdleTimeoutMs(preferences: SecurityPreferences): number {
  return preferences.idleTimeoutMinutes * 60 * 1000;
}

function currentStatus(): AppLockStatus {
  if (isSessionUnlocked()) {
    return "unlocked";
  }

  return hasConfiguredAppLock() ? "locked" : "setup";
}

type VaultAccessPanelProps = {
  status: Exclude<AppLockStatus, "unlocked">;
  busy: boolean;
  onSetup: (passphrase: string, confirmPassphrase: string) => Promise<void>;
  onUnlock: (passphrase: string) => Promise<void>;
};

function VaultAccessPanel({ status, busy, onSetup, onUnlock }: Readonly<VaultAccessPanelProps>) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const setupFeedback = buildPassphrasePolicyFeedback("vault");
  const title = status === "setup" ? "Create vault passphrase" : "Unlock vault";
  const description =
    status === "setup"
      ? "Your passphrase derives the local encryption key and is required to open the app in future sessions."
      : "Enter your passphrase to restore the in-memory session key and decrypt protected records.";
  let submitLabel = "Unlock Vault";

  if (busy) {
    submitLabel = "Working...";
  } else if (status === "setup") {
    submitLabel = "Enable App Lock";
  }

  useEffect(() => {
    setPassphrase("");
    setConfirmPassphrase("");
    setErrorMessage(null);
  }, [status]);

  const handleSubmit: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    setErrorMessage(null);

    const run = async () => {
      try {
        if (status === "setup") {
          await onSetup(passphrase, confirmPassphrase);
          return;
        }

        await onUnlock(passphrase);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to access protected vault");
      }
    };

    void run();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">ProofVault Security</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-50">{title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{description}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm text-zinc-200">
            <span className="mb-1 block">Passphrase</span>
            <input
              type="password"
              autoFocus
              autoComplete={status === "setup" ? "new-password" : "current-password"}
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
              required
            />
          </label>

          {status === "setup" ? (
            <label className="block text-sm text-zinc-200">
              <span className="mb-1 block">Confirm passphrase</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassphrase}
                onChange={(event) => setConfirmPassphrase(event.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none ring-emerald-500/40 focus:ring"
                required
              />
            </label>
          ) : null}

          {errorMessage ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </form>

        <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-xs text-zinc-400">
          <p>Protected at rest: evidence descriptions, locations, people, tags, and case descriptions.</p>
          <p className="mt-1">The passphrase is not sent anywhere and is not recoverable from local storage.</p>
          {status === "setup" ? (
            <>
              <p className="mt-2">{setupFeedback.guidance[0]}</p>
              <p className="mt-1">{setupFeedback.guidance[1]}</p>
              <p className="mt-1 text-amber-300">{setupFeedback.warnings[0]}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VaultMigrationPanel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">ProofVault Security</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-50">Securing local records</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Existing vault entries are being re-saved with encrypted sensitive fields before the app opens.
        </p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}

type AppLockProviderProps = {
  children: ReactNode;
};

export function AppLockProvider({ children }: Readonly<AppLockProviderProps>) {
  const [status, setStatus] = useState<AppLockStatus>(() => currentStatus());
  const [busy, setBusy] = useState(false);
  const [preferences, setPreferences] = useState<SecurityPreferences>(() => getSecurityPreferences());
  const idleTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      globalThis.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const lockVault = useCallback(() => {
    clearIdleTimer();
    lockSession();
  }, [clearIdleTimer]);

  const scheduleIdleLock = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = globalThis.setTimeout(() => {
      lockVault();
    }, getIdleTimeoutMs(preferences));
  }, [clearIdleTimer, lockVault, preferences]);

  const setIdleTimeoutMinutes = useCallback((minutes: number) => {
    setPreferences(updateSecurityPreferences({ idleTimeoutMinutes: minutes }));
  }, []);

  const setLockOnHidden = useCallback((value: boolean) => {
    setPreferences(updateSecurityPreferences({ lockOnHidden: value }));
  }, []);

  const rotatePassphrase = useCallback(
    async (currentPassphrase: string, nextPassphrase: string) => {
      await rotatePassphraseForVault(currentPassphrase, nextPassphrase);
      setPreferences(getSecurityPreferences());
      scheduleIdleLock();
      setStatus(currentStatus());
    },
    [scheduleIdleLock]
  );

  useEffect(
    () =>
      subscribeToSessionState(() => {
        setStatus(currentStatus());
        setPreferences(getSecurityPreferences());
      }),
    []
  );

  useEffect(() => {
    if (status !== "unlocked" || busy) {
      clearIdleTimer();
      return;
    }

    const handleActivity = () => {
      scheduleIdleLock();
    };

    const handlePageHide = () => {
      lockVault();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && preferences.lockOnHidden) {
        lockVault();
      }
    };

    scheduleIdleLock();

    globalThis.addEventListener("pointerdown", handleActivity, true);
    globalThis.addEventListener("keydown", handleActivity, true);
    globalThis.addEventListener("mousemove", handleActivity, true);
    globalThis.addEventListener("scroll", handleActivity, true);
    globalThis.addEventListener("touchstart", handleActivity, true);
    globalThis.addEventListener("beforeunload", handlePageHide);
    globalThis.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearIdleTimer();
      globalThis.removeEventListener("pointerdown", handleActivity, true);
      globalThis.removeEventListener("keydown", handleActivity, true);
      globalThis.removeEventListener("mousemove", handleActivity, true);
      globalThis.removeEventListener("scroll", handleActivity, true);
      globalThis.removeEventListener("touchstart", handleActivity, true);
      globalThis.removeEventListener("beforeunload", handlePageHide);
      globalThis.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [busy, clearIdleTimer, lockVault, preferences.lockOnHidden, scheduleIdleLock, status]);

  const contextValue = useMemo<AppLockContextValue>(
    () => ({
      status,
      busy,
      lock: lockVault,
      idleTimeoutMinutes: preferences.idleTimeoutMinutes,
      lockOnHidden: preferences.lockOnHidden,
      setIdleTimeoutMinutes,
      setLockOnHidden,
      rotatePassphrase,
    }),
    [
      busy,
      lockVault,
      preferences.idleTimeoutMinutes,
      preferences.lockOnHidden,
      rotatePassphrase,
      setIdleTimeoutMinutes,
      setLockOnHidden,
      status,
    ]
  );

  const handleSetup = async (passphrase: string, confirmPassphrase: string) => {
    if (passphrase !== confirmPassphrase) {
      throw new Error("Passphrases do not match.");
    }

    setBusy(true);

    try {
      await initializeAppLock(passphrase);
      await migrateExistingSensitiveData();
      scheduleIdleLock();
      setStatus("unlocked");
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (passphrase: string) => {
    setBusy(true);

    try {
      await unlockSession(passphrase);
      await migrateExistingSensitiveData();
      scheduleIdleLock();
      setStatus("unlocked");
    } finally {
      setBusy(false);
    }
  };

  const lockedStatus: Exclude<AppLockStatus, "unlocked"> = status === "setup" ? "setup" : "locked";
  let content = <VaultAccessPanel status={lockedStatus} busy={busy} onSetup={handleSetup} onUnlock={handleUnlock} />;

  if (status === "unlocked") {
    content = busy ? <VaultMigrationPanel /> : <>{children}</>;
  }

  return (
    <AppLockContext.Provider value={contextValue}>
      {content}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  const context = useContext(AppLockContext);

  if (!context) {
    throw new Error("useAppLock must be used within AppLockProvider");
  }

  return context;
}