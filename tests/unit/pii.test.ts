import { describe, it, expect } from "vitest";
import { detectPII, redactPII, hasPII } from "@/lib/compliance/pii";

describe("detectPII", () => {
  it("returns empty for empty/null input", () => {
    expect(detectPII("")).toEqual([]);
  });

  it("returns empty for text with no PII", () => {
    expect(detectPII("Hello, how can I help you today?")).toEqual([]);
  });

  it("detects SSN (hyphenated)", () => {
    const out = detectPII("My SSN is 123-45-6789.");
    expect(out.some((d) => d.type === "ssn" && d.value === "123-45-6789")).toBe(true);
  });

  it("detects SSN (plain 9 digits)", () => {
    const out = detectPII("SSN: 123456789");
    expect(out.some((d) => d.type === "ssn")).toBe(true);
  });

  it("detects email", () => {
    const out = detectPII("Reach me at alice@example.com please");
    expect(out.some((d) => d.type === "email" && d.value === "alice@example.com")).toBe(true);
  });

  it("detects US phone numbers in various formats", () => {
    const samples = [
      "Call me at 555-123-4567",
      "Call me at (555) 123-4567",
      "My number is +1 555 123 4567",
      "Phone: 555.123.4567",
    ];
    for (const s of samples) {
      const out = detectPII(s);
      expect(out.some((d) => d.type === "phoneUS")).toBe(true);
    }
  });

  it("detects credit card numbers (Luhn-valid)", () => {
    // 4111111111111111 — classic Visa test card, Luhn-valid
    const out = detectPII("My card is 4111111111111111");
    expect(out.some((d) => d.type === "creditCard")).toBe(true);
  });

  it("rejects credit-card-like sequences that fail Luhn", () => {
    // 16 random digits that don't satisfy Luhn
    const out = detectPII("Reference number 1234567890123456");
    expect(out.some((d) => d.type === "creditCard")).toBe(false);
  });

  it("detects IPv4 addresses", () => {
    const out = detectPII("Client IP is 192.168.1.100");
    expect(out.some((d) => d.type === "ipv4")).toBe(true);
  });

  it("detects dates of birth", () => {
    const out = detectPII("DOB: 05/14/1987");
    expect(out.some((d) => d.type === "dob")).toBe(true);
  });

  it("detects US street addresses", () => {
    const out = detectPII("Ship to 123 Main Street");
    expect(out.some((d) => d.type === "usAddress")).toBe(true);
  });

  it("detects multiple PII items in one string", () => {
    const out = detectPII(
      "I am Alice, email alice@example.com, SSN 123-45-6789, card 4111111111111111"
    );
    const types = new Set(out.map((d) => d.type));
    expect(types.has("email")).toBe(true);
    expect(types.has("ssn")).toBe(true);
    expect(types.has("creditCard")).toBe(true);
  });

  it("results are sorted by start position", () => {
    const out = detectPII(
      "Email alice@example.com and call 555-123-4567"
    );
    for (let i = 1; i < out.length; i++) {
      expect(out[i].start).toBeGreaterThanOrEqual(out[i - 1].start);
    }
  });
});

describe("redactPII", () => {
  it("returns input unchanged when no PII", () => {
    expect(redactPII("Hello there")).toBe("Hello there");
  });

  it("redacts email addresses", () => {
    expect(redactPII("Email: alice@example.com")).toBe("Email: [REDACTED:EMAIL]");
  });

  it("redacts SSN", () => {
    const result = redactPII("SSN: 123-45-6789");
    expect(result).toContain("[REDACTED:SSN]");
    expect(result).not.toContain("123-45-6789");
  });

  it("redacts phone", () => {
    const result = redactPII("Call me at 555-123-4567");
    expect(result).toMatch(/\[REDACTED:PHONEUS\]/);
    expect(result).not.toContain("555-123-4567");
  });

  it("redacts credit card", () => {
    const result = redactPII("Card: 4111111111111111");
    expect(result).toContain("[REDACTED:CREDITCARD]");
    expect(result).not.toContain("4111111111111111");
  });

  it("redacts multiple items preserving other text", () => {
    const result = redactPII(
      "My email is alice@example.com and SSN is 123-45-6789."
    );
    expect(result).toContain("[REDACTED:EMAIL]");
    expect(result).toContain("[REDACTED:SSN]");
    expect(result).toContain("My email is");
    expect(result).toContain(" and SSN is ");
  });

  it("handles overlapping matches without producing broken output", () => {
    const result = redactPII("Contact: alice@example.com, 555-123-4567, SSN 123-45-6789");
    expect(result).not.toContain("alice@example.com");
    expect(result).not.toContain("123-45-6789");
    expect(result).not.toContain("555-123-4567");
  });

  it("is idempotent on already-redacted text", () => {
    const once = redactPII("SSN: 123-45-6789");
    const twice = redactPII(once);
    expect(twice).toBe(once);
  });
});

describe("hasPII", () => {
  it("returns true for text with PII", () => {
    expect(hasPII("Email alice@example.com")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(hasPII("Hello how are you")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasPII("")).toBe(false);
  });
});
