import { describe, it, expect, beforeEach } from "vitest";
import { encryptSecret, decryptSecret, decryptSecretMaybe } from "@/lib/crypto/secrets";

describe("crypto/secrets", () => {
  beforeEach(() => {
    // Use a deterministic 32-byte key for tests. The helper caches the key
    // module-level on first use; vitest gives each test file a fresh module
    // graph so this stays scoped to this suite.
    process.env.SECRETS_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("round-trips an ASCII secret", () => {
    const ct = encryptSecret("hello-world");
    expect(ct).not.toBe("hello-world");
    expect(decryptSecret(ct)).toBe("hello-world");
  });

  it("round-trips Unicode and long values", () => {
    const value = "Calendly PAT cal_pat_" + "x".repeat(500) + " — ✅";
    expect(decryptSecret(encryptSecret(value))).toBe(value);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  it("rejects tampered ciphertext (auth-tag mismatch)", () => {
    const ct = encryptSecret("important");
    // Flip a byte in the middle of the ciphertext body.
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects empty input on encrypt", () => {
    expect(() => encryptSecret("")).toThrow();
  });

  it("decryptSecretMaybe returns null for null/empty/invalid input", () => {
    expect(decryptSecretMaybe(null)).toBeNull();
    expect(decryptSecretMaybe(undefined)).toBeNull();
    expect(decryptSecretMaybe("")).toBeNull();
    expect(decryptSecretMaybe("not-base64-or-anything-meaningful")).toBeNull();
  });
});
