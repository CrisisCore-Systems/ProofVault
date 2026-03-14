import { createRandomBase64, decryptJson, deriveAesKeyFromPassphrase, encryptJson } from "./crypto";

const STORAGE_KEY = "proofvault.security.config.v1";
const VERIFIER_MARKER = "proofvault-session-unlock";
const MIN_PASSPHRASE_LENGTH = 10;

export type SecurityPreferences = {
  idleTimeoutMinutes: number;
  lockOnHidden: boolean;
};

const DEFAULT_SECURITY_PREFERENCES: SecurityPreferences = {
  idleTimeoutMinutes: 10,
  lockOnHidden: true,
};

export type SecurityConfig = {
  version: 1;
  salt: string;
  verifier: {
    version: 1;
    algorithm: "AES-GCM";
    iv: string;
    ciphertext: string;
  };
  preferences?: SecurityPreferences;
};

export type PreparedSessionConfig = {
  key: CryptoKey;
  salt: string;
  verifier: SecurityConfig["verifier"];
  preferences: SecurityPreferences;
};

type SessionStateListener = () => void;

let activeSessionKey: CryptoKey | null = null;
const listeners = new Set<SessionStateListener>();

function emitSessionChange() {
  listeners.forEach((listener) => listener());
}

function readStoredConfig(): SecurityConfig | null {
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SecurityConfig;
  } catch {
    return null;
  }
}

function writeStoredConfig(config: SecurityConfig) {
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function normalizePreferences(preferences?: Partial<SecurityPreferences>): SecurityPreferences {
  const idleTimeoutMinutes = preferences?.idleTimeoutMinutes;

  return {
    idleTimeoutMinutes:
      typeof idleTimeoutMinutes === "number" && Number.isFinite(idleTimeoutMinutes) && idleTimeoutMinutes >= 1
        ? Math.round(idleTimeoutMinutes)
        : DEFAULT_SECURITY_PREFERENCES.idleTimeoutMinutes,
    lockOnHidden: preferences?.lockOnHidden ?? DEFAULT_SECURITY_PREFERENCES.lockOnHidden,
  };
}

function validatePassphrase(passphrase: string) {
  if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }
}

async function deriveVerifiedKey(passphrase: string): Promise<CryptoKey> {
  const config = readStoredConfig();
  if (!config) {
    throw new Error("App lock has not been configured yet.");
  }

  return deriveVerifiedKeyFromConfig(passphrase, config);
}

export async function deriveVerifiedKeyFromConfig(
  passphrase: string,
  config: Pick<SecurityConfig, "salt" | "verifier">
): Promise<CryptoKey> {

  validatePassphrase(passphrase);

  const key = await deriveAesKeyFromPassphrase(passphrase, config.salt);

  try {
    const verifier = await decryptJson<{ marker: string }>(config.verifier, key);
    if (verifier.marker !== VERIFIER_MARKER) {
      throw new Error("Incorrect passphrase.");
    }
  } catch {
    throw new Error("Incorrect passphrase.");
  }

  return key;
}

export function hasConfiguredAppLock(): boolean {
  return readStoredConfig() !== null;
}

export function isSessionUnlocked(): boolean {
  return activeSessionKey !== null;
}

export function getSessionKey(): CryptoKey | null {
  return activeSessionKey;
}

export function getSecurityPreferences(): SecurityPreferences {
  const config = readStoredConfig();
  return normalizePreferences(config?.preferences);
}

export function getStoredSecurityConfigForBackup(): SecurityConfig {
  const config = readStoredConfig();

  if (!config) {
    throw new Error("App lock has not been configured yet.");
  }

  return {
    ...config,
    preferences: normalizePreferences(config.preferences),
  };
}

export function restoreSecurityConfigFromBackup(config: SecurityConfig): void {
  writeStoredConfig({
    ...config,
    preferences: normalizePreferences(config.preferences),
  });

  activeSessionKey = null;
  emitSessionChange();
}

export function updateSecurityPreferences(nextPreferences: Partial<SecurityPreferences>): SecurityPreferences {
  const config = readStoredConfig();

  if (!config) {
    return normalizePreferences(nextPreferences);
  }

  const preferences = normalizePreferences({
    ...config.preferences,
    ...nextPreferences,
  });

  writeStoredConfig({
    ...config,
    preferences,
  });

  emitSessionChange();

  return preferences;
}

export async function verifyPassphrase(passphrase: string): Promise<void> {
  await deriveVerifiedKey(passphrase);
}

export async function prepareSessionConfig(passphrase: string): Promise<PreparedSessionConfig> {
  validatePassphrase(passphrase);

  const salt = createRandomBase64(16);
  const key = await deriveAesKeyFromPassphrase(passphrase, salt);
  const verifier = await encryptJson({ marker: VERIFIER_MARKER }, key);

  return {
    key,
    salt,
    verifier,
    preferences: getSecurityPreferences(),
  };
}

export function applyPreparedSessionConfig(config: PreparedSessionConfig): void {
  writeStoredConfig({
    version: 1,
    salt: config.salt,
    verifier: config.verifier,
    preferences: config.preferences,
  });

  activeSessionKey = config.key;
  emitSessionChange();
}

export function getSessionKeyOrThrow(): CryptoKey {
  if (!activeSessionKey) {
    throw new Error("Vault is locked. Unlock the session to access protected data.");
  }

  return activeSessionKey;
}

export function lockSession(): void {
  activeSessionKey = null;
  emitSessionChange();
}

export async function initializeAppLock(passphrase: string): Promise<void> {
  if (hasConfiguredAppLock()) {
    throw new Error("App lock is already configured.");
  }

  const preparedConfig = await prepareSessionConfig(passphrase);

  applyPreparedSessionConfig({
    ...preparedConfig,
    preferences: DEFAULT_SECURITY_PREFERENCES,
  });
}

export async function unlockSession(passphrase: string): Promise<void> {
  activeSessionKey = await deriveVerifiedKey(passphrase);
  emitSessionChange();
}

export function subscribeToSessionState(listener: SessionStateListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}