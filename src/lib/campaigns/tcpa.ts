import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const PERMITTED_START_HOUR = 8;
const PERMITTED_END_HOUR = 21;
const MAX_ATTEMPTS = 3;
const MIN_RETRY_MINUTES = 30;

export interface TCPACheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkPermittedHours(timezone: string): TCPACheckResult {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    const hour = parseInt(formatter.format(now), 10);

    if (hour < PERMITTED_START_HOUR || hour >= PERMITTED_END_HOUR) {
      return {
        allowed: false,
        reason: `Outside permitted hours (${PERMITTED_START_HOUR}:00-${PERMITTED_END_HOUR}:00 in ${timezone}). Current: ${hour}:00`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export function checkDayOfWeek(): TCPACheckResult {
  const now = new Date();
  const day = now.getDay();
  if (day === 0) {
    return { allowed: false, reason: "No outbound calls on Sundays" };
  }
  return { allowed: true };
}

export function checkRetryEligibility(
  callAttempts: number,
  maxAttempts: number,
  lastCalledAt: Date | null,
  retryDelayMinutes: number
): TCPACheckResult {
  if (callAttempts >= (maxAttempts || MAX_ATTEMPTS)) {
    return { allowed: false, reason: `Max attempts reached (${callAttempts}/${maxAttempts || MAX_ATTEMPTS})` };
  }

  if (lastCalledAt) {
    const minsSinceLastCall = (Date.now() - lastCalledAt.getTime()) / 60000;
    if (minsSinceLastCall < Math.max(retryDelayMinutes, MIN_RETRY_MINUTES)) {
      return {
        allowed: false,
        reason: `Too soon since last attempt (${Math.round(minsSinceLastCall)}m ago, need ${retryDelayMinutes}m)`,
      };
    }
  }

  return { allowed: true };
}

export function checkConsent(consentGranted: boolean): TCPACheckResult {
  if (!consentGranted) {
    return { allowed: false, reason: "No consent granted for outbound calls" };
  }
  return { allowed: true };
}

export function checkDoNotCall(doNotCall: boolean): TCPACheckResult {
  if (doNotCall) {
    return { allowed: false, reason: "Lead is on the do-not-call list" };
  }
  return { allowed: true };
}

export function runAllChecks(lead: {
  timezone: string | null;
  callAttempts: number | null;
  maxAttempts: number | null;
  lastCalledAt: Date | null;
  consentGranted: boolean | null;
  doNotCall: boolean | null;
}, retryDelayMinutes: number): TCPACheckResult {
  const checks = [
    checkDayOfWeek(),
    checkPermittedHours(lead.timezone || "America/New_York"),
    checkDoNotCall(lead.doNotCall ?? false),
    checkConsent(lead.consentGranted ?? false),
    checkRetryEligibility(
      lead.callAttempts ?? 0,
      lead.maxAttempts ?? MAX_ATTEMPTS,
      lead.lastCalledAt,
      retryDelayMinutes
    ),
  ];

  const failed = checks.find((c) => !c.allowed);
  return failed || { allowed: true };
}
