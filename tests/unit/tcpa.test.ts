import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkPermittedHours,
  checkDayOfWeek,
  checkRetryEligibility,
  checkConsent,
  checkDoNotCall,
  runAllChecks,
} from "@/lib/campaigns/tcpa";

describe("checkPermittedHours", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calls at 10:00 local time", () => {
    // 10:00 AM in America/New_York = 14:00 UTC
    vi.setSystemTime(new Date("2026-04-15T14:00:00Z"));
    const r = checkPermittedHours("America/New_York");
    expect(r.allowed).toBe(true);
  });

  it("allows calls at boundary 8:00", () => {
    vi.setSystemTime(new Date("2026-04-15T12:00:00Z")); // 8:00 ET
    const r = checkPermittedHours("America/New_York");
    expect(r.allowed).toBe(true);
  });

  it("rejects calls before 8:00 AM", () => {
    vi.setSystemTime(new Date("2026-04-15T11:30:00Z")); // 7:30 ET
    const r = checkPermittedHours("America/New_York");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/outside permitted hours/i);
  });

  it("rejects calls at or after 21:00 (9 PM)", () => {
    vi.setSystemTime(new Date("2026-04-16T01:30:00Z")); // 21:30 ET (9:30 PM)
    const r = checkPermittedHours("America/New_York");
    expect(r.allowed).toBe(false);
  });

  it("rejects calls at exact 21:00 boundary", () => {
    vi.setSystemTime(new Date("2026-04-16T01:00:00Z")); // 21:00 ET exactly
    const r = checkPermittedHours("America/New_York");
    expect(r.allowed).toBe(false);
  });

  it("allows call at 20:59", () => {
    vi.setSystemTime(new Date("2026-04-16T00:59:00Z")); // 20:59 ET
    const r = checkPermittedHours("America/New_York");
    expect(r.allowed).toBe(true);
  });

  it("respects different timezones", () => {
    // 10:00 AM America/Los_Angeles = 17:00 UTC
    vi.setSystemTime(new Date("2026-04-15T17:00:00Z"));
    expect(checkPermittedHours("America/Los_Angeles").allowed).toBe(true);
    // Same moment is 13:00 ET — still permitted
    expect(checkPermittedHours("America/New_York").allowed).toBe(true);
    // Same moment is 07:00 AM Asia/Tokyo -> not in window there (in UTC wrap)
  });

  it("handles invalid timezone gracefully (fail-open)", () => {
    vi.setSystemTime(new Date("2026-04-15T14:00:00Z"));
    const r = checkPermittedHours("Not/A/Real/Zone");
    expect(r.allowed).toBe(true);
  });
});

describe("checkDayOfWeek", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks Sunday", () => {
    // Sunday, April 19 2026 15:00 UTC
    vi.setSystemTime(new Date("2026-04-19T15:00:00Z"));
    const r = checkDayOfWeek();
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/sunday/i);
  });

  it("allows Monday through Saturday", () => {
    const mondayThruSaturday = [
      "2026-04-13T15:00:00Z", // Mon
      "2026-04-14T15:00:00Z", // Tue
      "2026-04-15T15:00:00Z", // Wed
      "2026-04-16T15:00:00Z", // Thu
      "2026-04-17T15:00:00Z", // Fri
      "2026-04-18T15:00:00Z", // Sat
    ];
    for (const iso of mondayThruSaturday) {
      vi.setSystemTime(new Date(iso));
      expect(checkDayOfWeek().allowed).toBe(true);
    }
  });
});

describe("checkRetryEligibility", () => {
  it("blocks when max attempts reached", () => {
    const r = checkRetryEligibility(3, 3, null, 60);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/max attempts/i);
  });

  it("blocks when attempts exceed max", () => {
    const r = checkRetryEligibility(5, 3, null, 60);
    expect(r.allowed).toBe(false);
  });

  it("uses default max of 3 when maxAttempts is 0/falsy", () => {
    const r = checkRetryEligibility(3, 0, null, 60);
    expect(r.allowed).toBe(false);
  });

  it("allows first call (no lastCalledAt)", () => {
    const r = checkRetryEligibility(0, 3, null, 60);
    expect(r.allowed).toBe(true);
  });

  it("blocks retry if not enough time has passed", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const r = checkRetryEligibility(1, 3, tenMinutesAgo, 60);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/too soon/i);
  });

  it("allows retry when retry delay has passed", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const r = checkRetryEligibility(1, 3, twoHoursAgo, 60);
    expect(r.allowed).toBe(true);
  });

  it("enforces MIN_RETRY_MINUTES (30) as floor", () => {
    // retryDelay is 5 minutes, but min is 30
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const r = checkRetryEligibility(1, 3, tenMinutesAgo, 5);
    expect(r.allowed).toBe(false);
  });

  it("allows retry after 31 minutes with 5 min retryDelay (floor protects)", () => {
    const thirtyOneMinAgo = new Date(Date.now() - 31 * 60 * 1000);
    const r = checkRetryEligibility(1, 3, thirtyOneMinAgo, 5);
    expect(r.allowed).toBe(true);
  });
});

describe("checkConsent", () => {
  it("rejects when consent is not granted", () => {
    expect(checkConsent(false).allowed).toBe(false);
  });

  it("allows when consent is granted", () => {
    expect(checkConsent(true).allowed).toBe(true);
  });
});

describe("checkDoNotCall", () => {
  it("rejects DNC-listed leads", () => {
    const r = checkDoNotCall(true);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/do-not-call/i);
  });

  it("allows non-DNC leads", () => {
    expect(checkDoNotCall(false).allowed).toBe(true);
  });
});

describe("runAllChecks — composite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T14:00:00Z")); // Wed 10:00 ET, permitted
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes when all checks are green", () => {
    const r = runAllChecks(
      {
        timezone: "America/New_York",
        callAttempts: 0,
        maxAttempts: 3,
        lastCalledAt: null,
        consentGranted: true,
        doNotCall: false,
      },
      60
    );
    expect(r.allowed).toBe(true);
  });

  it("short-circuits on Sunday regardless of consent", () => {
    vi.setSystemTime(new Date("2026-04-19T15:00:00Z")); // Sunday
    const r = runAllChecks(
      {
        timezone: "America/New_York",
        callAttempts: 0,
        maxAttempts: 3,
        lastCalledAt: null,
        consentGranted: true,
        doNotCall: false,
      },
      60
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/sunday/i);
  });

  it("short-circuits on DNC", () => {
    const r = runAllChecks(
      {
        timezone: "America/New_York",
        callAttempts: 0,
        maxAttempts: 3,
        lastCalledAt: null,
        consentGranted: true,
        doNotCall: true,
      },
      60
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/do-not-call/i);
  });

  it("short-circuits on missing consent", () => {
    const r = runAllChecks(
      {
        timezone: "America/New_York",
        callAttempts: 0,
        maxAttempts: 3,
        lastCalledAt: null,
        consentGranted: false,
        doNotCall: false,
      },
      60
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/consent/i);
  });

  it("handles null timezone by defaulting to NY", () => {
    const r = runAllChecks(
      {
        timezone: null,
        callAttempts: 0,
        maxAttempts: 3,
        lastCalledAt: null,
        consentGranted: true,
        doNotCall: false,
      },
      60
    );
    expect(r.allowed).toBe(true);
  });

  it("handles null booleans safely (default to false)", () => {
    const r = runAllChecks(
      {
        timezone: "America/New_York",
        callAttempts: null,
        maxAttempts: null,
        lastCalledAt: null,
        consentGranted: null,
        doNotCall: null,
      },
      60
    );
    // consent null -> treated as false -> blocked
    expect(r.allowed).toBe(false);
  });
});
