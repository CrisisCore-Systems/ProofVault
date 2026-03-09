import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getVaultMeta, saveVaultMeta } from "../../db/queries";
import { checkVerifier, createVerifier, deriveKey, generateSalt } from "../../lib/crypto/vault";
import type { VaultMeta } from "../../domain/types";

export type VaultStatus = "loading" | "setup-required" | "locked" | "unlocked";

type VaultContextValue = {
  status: VaultStatus;
  sessionKey: CryptoKey | null;
  setupVault: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used inside VaultProvider");
  }
  return ctx;
}

type VaultProviderProps = {
  children: ReactNode;
};

export function VaultProvider({ children }: Readonly<VaultProviderProps>) {
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    const checkVaultInit = async () => {
      const meta = await getVaultMeta();
      if (meta) {
        setStatus("locked");
      } else {
        setStatus("setup-required");
      }
    };

    void checkVaultInit();
  }, []);

  const setupVault = useCallback(async (passphrase: string) => {
    const salt = await generateSalt();
    const key = await deriveKey(passphrase, salt);
    const { ciphertext, iv } = await createVerifier(key);

    const meta: VaultMeta = {
      id: "singleton",
      salt,
      verifierCiphertext: ciphertext,
      verifierIv: iv,
      createdAt: new Date().toISOString(),
    };

    await saveVaultMeta(meta);
    setSessionKey(key);
    setStatus("unlocked");
  }, []);

  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    const meta = await getVaultMeta();
    if (!meta) {
      return false;
    }

    const key = await deriveKey(passphrase, meta.salt);
    const valid = await checkVerifier(key, meta.verifierCiphertext, meta.verifierIv);

    if (valid) {
      setSessionKey(key);
      setStatus("unlocked");
    }

    return valid;
  }, []);

  const lock = useCallback(() => {
    setSessionKey(null);
    setStatus("locked");
  }, []);

  const value = useMemo(
    () => ({ status, sessionKey, setupVault, unlock, lock }),
    [status, sessionKey, setupVault, unlock, lock]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
