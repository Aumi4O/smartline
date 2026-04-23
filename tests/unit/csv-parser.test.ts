import { describe, it, expect } from "vitest";
import { parseCSV, normalizePhone, detectTimezone } from "@/lib/campaigns/csv-parser";

describe("normalizePhone", () => {
  it("normalizes 10-digit US number", () => {
    expect(normalizePhone("5551234567")).toBe("+15551234567");
  });

  it("normalizes 11-digit with leading 1", () => {
    expect(normalizePhone("15551234567")).toBe("+15551234567");
  });

  it("strips formatting (dashes, parens, spaces)", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("555.123.4567")).toBe("+15551234567");
    expect(normalizePhone("+1 555 123 4567")).toBe("+15551234567");
  });

  it("rejects numbers that are too short", () => {
    expect(normalizePhone("555123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abcd")).toBeNull();
  });

  it("handles 11-digit without leading 1 (international)", () => {
    // 11 digits not starting with 1 gets +-prefixed as international
    expect(normalizePhone("44123456789")).toBe("+44123456789");
  });

  it("truncates overly-long numbers with leading 1", () => {
    expect(normalizePhone("1555123456789")).toBe("+15551234567");
  });
});

describe("detectTimezone", () => {
  it("maps NYC (212) to America/New_York", () => {
    expect(detectTimezone("+12125551234")).toBe("America/New_York");
  });

  it("maps LA (310) to America/Los_Angeles", () => {
    expect(detectTimezone("+13105551234")).toBe("America/Los_Angeles");
  });

  it("maps Chicago (312) to America/Chicago", () => {
    expect(detectTimezone("+13125551234")).toBe("America/Chicago");
  });

  it("maps Hawaii (808) to Pacific/Honolulu", () => {
    expect(detectTimezone("+18085551234")).toBe("Pacific/Honolulu");
  });

  it("maps Phoenix (602) to America/Phoenix (no DST)", () => {
    expect(detectTimezone("+16025551234")).toBe("America/Phoenix");
  });

  it("defaults to America/New_York for unknown area codes", () => {
    expect(detectTimezone("+19995551234")).toBe("America/New_York");
  });

  it("handles raw 10-digit format", () => {
    expect(detectTimezone("3105551234")).toBe("America/Los_Angeles");
  });
});

describe("parseCSV", () => {
  it("parses valid CSV with canonical headers", () => {
    const csv = `first_name,last_name,phone,email
Alice,Smith,555-123-4567,alice@example.com
Bob,Jones,+1-310-555-9876,bob@example.com`;
    const { leads, errors } = parseCSV(csv);
    expect(errors).toEqual([]);
    expect(leads).toHaveLength(2);
    expect(leads[0]).toMatchObject({
      firstName: "Alice",
      lastName: "Smith",
      phone: "+15551234567",
      email: "alice@example.com",
      timezone: "America/New_York",
    });
    expect(leads[1].timezone).toBe("America/Los_Angeles");
  });

  it("recognizes alternate header names", () => {
    const csv = `FirstName,LastName,Mobile,Email
Alice,Smith,5551234567,alice@example.com`;
    const { leads, errors } = parseCSV(csv);
    expect(errors).toEqual([]);
    expect(leads[0].firstName).toBe("Alice");
    expect(leads[0].phone).toBe("+15551234567");
  });

  it("requires a phone column", () => {
    const csv = `first_name,last_name,email
Alice,Smith,alice@example.com`;
    const { leads, errors } = parseCSV(csv);
    expect(leads).toEqual([]);
    expect(errors[0]).toMatch(/phone/i);
  });

  it("requires header row and data row", () => {
    const { errors: e1 } = parseCSV("");
    const { errors: e2 } = parseCSV("first_name,phone\n");
    expect(e1[0]).toMatch(/header/i);
    expect(e2[0]).toMatch(/header/i);
  });

  it("rejects invalid phone numbers", () => {
    const csv = `phone,email
xyz,alice@example.com
12,bob@example.com`;
    const { leads, errors } = parseCSV(csv);
    expect(leads).toHaveLength(0);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/invalid phone/i);
  });

  it("rejects rows with missing phone", () => {
    const csv = `first_name,phone,email
Alice,,alice@example.com
Bob,5551234567,bob@example.com`;
    const { leads, errors } = parseCSV(csv);
    expect(leads).toHaveLength(1);
    expect(errors[0]).toMatch(/missing phone/i);
  });

  it("de-duplicates by normalized phone number", () => {
    const csv = `first_name,phone
Alice,(555) 123-4567
Bob,555-123-4567
Carol,5551234567`;
    const { leads, errors } = parseCSV(csv);
    expect(leads).toHaveLength(1);
    expect(leads[0].firstName).toBe("Alice");
    expect(errors.filter((e) => /duplicate/i.test(e))).toHaveLength(2);
  });

  it("handles quoted fields with commas", () => {
    const csv = `first_name,phone,notes
Alice,"555-123-4567","hello, world"
Bob,5105551111,simple`;
    const { leads } = parseCSV(csv);
    expect(leads).toHaveLength(2);
    expect(leads[0].notes).toBe("hello, world");
    expect(leads[1].notes).toBe("simple");
  });

  it("handles quoted fields with escaped quotes", () => {
    const csv = `first_name,phone,notes
Alice,5551234567,"she said ""hi"""`;
    const { leads } = parseCSV(csv);
    expect(leads[0].notes).toBe('she said "hi"');
  });

  it("strips quotes from header", () => {
    const csv = `"first_name","phone"
Alice,5551234567`;
    const { leads, errors } = parseCSV(csv);
    expect(errors).toEqual([]);
    expect(leads[0].firstName).toBe("Alice");
  });

  it("handles blank lines and trailing whitespace", () => {
    const csv = `first_name,phone\n\nAlice,5551234567\n\n\nBob,5105551111\n`;
    const { leads, errors } = parseCSV(csv);
    expect(errors).toEqual([]);
    expect(leads).toHaveLength(2);
  });

  it("handles Windows-style CRLF line endings", () => {
    const csv = "first_name,phone\r\nAlice,5551234567\r\nBob,5105551111\r\n";
    const { leads, errors } = parseCSV(csv);
    expect(errors).toEqual([]);
    expect(leads).toHaveLength(2);
  });

  it("detects timezone from the phone area code", () => {
    const csv = `phone
2125551234
3105551234
3125551234
8085551234`;
    const { leads } = parseCSV(csv);
    const tzs = leads.map((l) => l.timezone);
    expect(tzs).toEqual([
      "America/New_York",
      "America/Los_Angeles",
      "America/Chicago",
      "Pacific/Honolulu",
    ]);
  });

  it("leaves optional fields undefined when absent", () => {
    const csv = `phone\n5551234567`;
    const { leads } = parseCSV(csv);
    expect(leads[0].firstName).toBeUndefined();
    expect(leads[0].email).toBeUndefined();
    expect(leads[0].company).toBeUndefined();
  });
});
