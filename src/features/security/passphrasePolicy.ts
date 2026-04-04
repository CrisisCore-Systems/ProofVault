const MIN_PASSPHRASE_LENGTH = 14;
const RECOMMENDED_PASSPHRASE_LENGTH = 18;
const COMMON_BREACHED_TOKENS = ["password", "123456", "qwerty", "letmein", "welcome", "admin", "trustno1"];
const SEQUENCE_SOURCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiopasdfghjklzxcvbnm"];

export type PassphraseUsage = "vault" | "backup";

export type PassphrasePolicyFeedback = {
  minimumLength: number;
  recommendedLength: number;
  guidance: string[];
  warnings: string[];
};

function normalizeForPatternChecks(passphrase: string): string {
  return passphrase.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function hasSequentialRun(passphrase: string): boolean {
  const normalized = normalizeForPatternChecks(passphrase);

  return SEQUENCE_SOURCES.some((source) => {
    for (let index = 0; index <= normalized.length - 4; index += 1) {
      const segment = normalized.slice(index, index + 4);
      if (segment.length === 4 && (source.includes(segment) || source.split("").reverse().join("").includes(segment))) {
        return true;
      }
    }

    return false;
  });
}

function hasRepeatedPattern(passphrase: string): boolean {
  return /(.)\1{3,}/.test(passphrase) || /(.{2,4})\1{2,}/.test(passphrase);
}

function countWordLikeSegments(passphrase: string): number {
  return passphrase
    .trim()
    .split(/[\s_-]+/)
    .filter((segment) => segment.length > 0).length;
}

export function buildPassphrasePolicyFeedback(usage: PassphraseUsage): PassphrasePolicyFeedback {
  const shared = [
    `Use at least ${MIN_PASSPHRASE_LENGTH} characters; ${RECOMMENDED_PASSPHRASE_LENGTH}+ is better.`,
    "Prefer 4 or more unrelated words or a long phrase with mixed punctuation.",
    "Avoid names, dates, keyboard walks, repeated fragments, and anything seen in another breach.",
  ];

  const warnings =
    usage === "backup"
      ? ["Do not reuse the vault passphrase for encrypted backups."]
      : ["Do not reuse this vault passphrase for backups, email, or any other account."];

  return {
    minimumLength: MIN_PASSPHRASE_LENGTH,
    recommendedLength: RECOMMENDED_PASSPHRASE_LENGTH,
    guidance: shared,
    warnings,
  };
}

export function validatePassphrasePolicy(
  passphrase: string,
  usage: PassphraseUsage,
  otherPassphrase?: string
): void {
  const feedback = buildPassphrasePolicyFeedback(usage);
  const trimmed = passphrase.trim();

  if (trimmed.length < feedback.minimumLength) {
    throw new Error(`Passphrase must be at least ${feedback.minimumLength} characters.`);
  }

  if (trimmed !== passphrase) {
    throw new Error("Passphrase cannot start or end with whitespace.");
  }

  const normalized = normalizeForPatternChecks(passphrase);
  if (COMMON_BREACHED_TOKENS.some((token) => normalized.includes(token))) {
    throw new Error("Passphrase includes a pattern commonly found in breached credentials. Choose a less predictable phrase.");
  }

  if (hasSequentialRun(passphrase)) {
    throw new Error("Passphrase contains an obvious keyboard or numeric sequence. Choose less predictable words or separators.");
  }

  if (hasRepeatedPattern(passphrase)) {
    throw new Error("Passphrase repeats the same character or fragment too many times. Choose a less repetitive phrase.");
  }

  if (countWordLikeSegments(passphrase) < 3 && passphrase.length < feedback.recommendedLength) {
    throw new Error("Passphrase is too short for a low-entropy pattern. Use a longer phrase or 4+ unrelated words.");
  }

  if (otherPassphrase && passphrase === otherPassphrase) {
    throw new Error(
      usage === "backup"
        ? "Backup passphrase must be different from the vault passphrase."
        : "Vault passphrase must be different from the compared passphrase."
    );
  }
}