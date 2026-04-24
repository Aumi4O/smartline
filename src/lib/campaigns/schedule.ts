/**
 * Campaign call window + segment filter. Stored in the existing JSONB column
 * `campaigns.schedule` so we don't need a migration for launch.
 *
 * Defaults are conservative (TCPA-friendly): Mon–Fri 9am–8pm local time to the
 * lead's timezone, no segment filter (call all leads in the campaign).
 */

export interface CampaignCallWindow {
  /** IANA timezone used when lead has no timezone of its own, e.g. "America/New_York". */
  fallbackTimezone: string;
  /** 0=Sunday … 6=Saturday. Days of the week outbound calls are allowed. */
  daysOfWeek: number[];
  /** Inclusive — 0–23, local time. E.g. 9 means we can start at 9:00am. */
  startHour: number;
  /** Exclusive — 0–24, local time. E.g. 20 means the last call starts before 8:00pm. */
  endHour: number;
}

export interface CampaignSchedule {
  callWindow: CampaignCallWindow;
  /** Case-insensitive segment tag. Only leads with this segment are dialed. */
  leadSegmentFilter: string | null;
}

export const DEFAULT_CALL_WINDOW: CampaignCallWindow = {
  fallbackTimezone: "America/New_York",
  daysOfWeek: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 20,
};

export const DEFAULT_SCHEDULE: CampaignSchedule = {
  callWindow: DEFAULT_CALL_WINDOW,
  leadSegmentFilter: null,
};

export function parseSchedule(value: unknown): CampaignSchedule {
  if (!value || typeof value !== "object") return DEFAULT_SCHEDULE;
  const v = value as Record<string, unknown>;
  const cw = (v.callWindow || {}) as Record<string, unknown>;

  const days = Array.isArray(cw.daysOfWeek)
    ? (cw.daysOfWeek as unknown[])
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : DEFAULT_CALL_WINDOW.daysOfWeek;

  const startHour =
    typeof cw.startHour === "number" && cw.startHour >= 0 && cw.startHour <= 23
      ? cw.startHour
      : DEFAULT_CALL_WINDOW.startHour;

  const endHour =
    typeof cw.endHour === "number" && cw.endHour > startHour && cw.endHour <= 24
      ? cw.endHour
      : DEFAULT_CALL_WINDOW.endHour;

  const fallbackTimezone =
    typeof cw.fallbackTimezone === "string" && cw.fallbackTimezone
      ? cw.fallbackTimezone
      : DEFAULT_CALL_WINDOW.fallbackTimezone;

  const leadSegmentFilter =
    typeof v.leadSegmentFilter === "string" && v.leadSegmentFilter.trim()
      ? v.leadSegmentFilter.trim()
      : null;

  return {
    callWindow: { fallbackTimezone, daysOfWeek: days, startHour, endHour },
    leadSegmentFilter,
  };
}

/**
 * Returns true if "now" (in the provided timezone) is inside the configured
 * call window. Used both when picking the next lead and as a guardrail at
 * dial time.
 */
export function isInsideCallWindow(
  window: CampaignCallWindow,
  timezone: string,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      weekday: "short",
      timeZone: timezone || window.fallbackTimezone,
    });
    const parts = fmt.formatToParts(now);
    const hour = parseInt(
      parts.find((p) => p.type === "hour")?.value ?? "0",
      10
    );
    const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dow = weekdayMap[weekdayShort] ?? new Date().getDay();

    if (!window.daysOfWeek.includes(dow)) {
      return {
        allowed: false,
        reason: `Outside allowed days for ${timezone} (today is ${weekdayShort})`,
      };
    }
    if (hour < window.startHour || hour >= window.endHour) {
      return {
        allowed: false,
        reason: `Outside call window ${window.startHour}:00–${window.endHour}:00 in ${timezone} (now ${hour}:00)`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
