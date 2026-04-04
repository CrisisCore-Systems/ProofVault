import { describe, expect, it } from "vitest";
import { buildPassphrasePolicyFeedback, validatePassphrasePolicy } from "./passphrasePolicy";

describe("passphrasePolicy", () => {
  it("accepts long multi-word passphrases", () => {
    expect(() => validatePassphrasePolicy("lantern-ridge-copper-echo-47", "vault")).not.toThrow();
    expect(() => validatePassphrasePolicy("cedar-harbor-orbit-moss-91", "backup")).not.toThrow();
  });

  it("rejects breached and sequential patterns", () => {
    expect(() => validatePassphrasePolicy("password-1234-safe", "vault")).toThrow(/breached credentials/i);
    expect(() => validatePassphrasePolicy("harbor-1234-lantern", "backup")).toThrow(/sequence/i);
  });

  it("rejects reuse when a comparison passphrase is supplied", () => {
    expect(() =>
      validatePassphrasePolicy("lantern-ridge-copper-echo-47", "backup", "lantern-ridge-copper-echo-47")
    ).toThrow(/different from the vault passphrase/i);
  });

  it("returns usage-specific warnings", () => {
    expect(buildPassphrasePolicyFeedback("vault").warnings[0]).toMatch(/Do not reuse this vault passphrase/i);
    expect(buildPassphrasePolicyFeedback("backup").warnings[0]).toMatch(/Do not reuse the vault passphrase/i);
  });
});
