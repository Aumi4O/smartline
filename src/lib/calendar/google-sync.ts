import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointments,
  calendarIntegrations,
  leads,
} from "@/lib/db/schema";
import {
  GoogleSyncTokenInvalid,
  listEvents,
  type GoogleEvent,
} from "@/lib/calendar/google";
import { getFreshGoogleAccessToken } from "@/lib/calendar/google-tokens";

/**
 * Upsert a single Google Calendar event into the appointments table.
 * Status mapping:
 *   - event.status === "cancelled" -> our "canceled"
 *   - "tentative" -> "confirmed" (we treat tentatives as bookings on calendar)
 *   - default -> "confirmed"
 */
export async function upsertAppointmentFromGoogleEvent(
  orgId: string,
  integrationId: string,
  evt: GoogleEvent
): Promise<void> {
  if (!evt.id) return;

  const startsAt = evt.start?.dateTime
    ? new Date(evt.start.dateTime)
    : evt.start?.date
      ? new Date(evt.start.date)
      : null;
  const endsAt = evt.end?.dateTime
    ? new Date(evt.end.dateTime)
    : evt.end?.date
      ? new Date(evt.end.date)
      : null;

  const status: "confirmed" | "canceled" =
    evt.status === "cancelled" ? "canceled" : "confirmed";

  const attendee = (evt.attendees || []).find((a) => a.email && a.email !== evt.organizer?.email);
  const attendeeEmail = attendee?.email || null;
  const attendeeName = attendee?.displayName || null;

  let leadId: string | null = null;
  if (attendeeEmail) {
    const match = await db.query.leads.findFirst({
      where: and(eq(leads.orgId, orgId), eq(leads.email, attendeeEmail)),
    });
    leadId = match?.id ?? null;
  }

  const meetEntry = (evt.conferenceData?.entryPoints || []).find(
    (e) => e.entryPointType === "video"
  );

  const values = {
    orgId,
    integrationId,
    provider: "google" as const,
    externalEventId: evt.id,
    externalEventUri: evt.htmlLink || null,
    leadId,
    title: evt.summary || "Google Calendar event",
    description: evt.description || null,
    status,
    startsAt,
    endsAt,
    timezone: evt.start?.timeZone || evt.end?.timeZone || null,
    attendeeName,
    attendeeEmail,
    attendeePhone: null,
    location: evt.location || null,
    joinUrl: meetEntry?.uri || evt.hangoutLink || null,
    cancelUrl: null,
    rescheduleUrl: null,
    metadata: {
      organizer: evt.organizer || null,
      attendees: evt.attendees || [],
    },
    updatedAt: new Date(),
  };

  const existing = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.provider, "google"),
      eq(appointments.externalEventId, evt.id)
    ),
  });

  if (existing) {
    await db.update(appointments).set(values).where(eq(appointments.id, existing.id));
  } else {
    await db.insert(appointments).values(values);
  }
}

/**
 * Run an incremental sync for a Google integration: pulls events using the
 * stored sync token, upserts each into appointments, and persists the new
 * sync token. On 410 Gone, performs a full re-sync (last 30 days + future).
 */
export async function syncGoogleCalendar(integrationId: string): Promise<{
  events: number;
  reset: boolean;
}> {
  const row = await db.query.calendarIntegrations.findFirst({
    where: eq(calendarIntegrations.id, integrationId),
  });
  if (!row || row.provider !== "google" || row.status !== "active") {
    return { events: 0, reset: false };
  }

  const accessToken = await getFreshGoogleAccessToken(integrationId);
  const calendarId = row.googleCalendarId || "primary";

  let resetUsed = false;
  let processed = 0;
  let pageToken: string | undefined;
  let syncToken: string | undefined = row.googleSyncToken ?? undefined;
  let nextSync: string | null = null;

  try {
    do {
      const page = await listEvents(accessToken, {
        calendarId,
        syncToken,
        pageToken,
        showDeleted: true,
      });
      for (const evt of page.items) {
        await upsertAppointmentFromGoogleEvent(row.orgId, integrationId, evt);
        processed += 1;
      }
      pageToken = page.nextPageToken;
      if (!pageToken && page.nextSyncToken) {
        nextSync = page.nextSyncToken;
      }
      // After the first page the syncToken must NOT be sent again.
      syncToken = undefined;
    } while (pageToken);
  } catch (err) {
    if (err instanceof GoogleSyncTokenInvalid) {
      resetUsed = true;
      // Full re-sync: 30 days back + any future.
      pageToken = undefined;
      syncToken = undefined;
      nextSync = null;
      let token: string | undefined;
      do {
        const page = await listEvents(accessToken, {
          calendarId,
          pageToken: token,
          timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          showDeleted: true,
        });
        for (const evt of page.items) {
          await upsertAppointmentFromGoogleEvent(row.orgId, integrationId, evt);
          processed += 1;
        }
        token = page.nextPageToken;
        if (!token && page.nextSyncToken) {
          nextSync = page.nextSyncToken;
        }
      } while (token);
    } else {
      throw err;
    }
  }

  if (nextSync) {
    await db
      .update(calendarIntegrations)
      .set({ googleSyncToken: nextSync, updatedAt: new Date() })
      .where(eq(calendarIntegrations.id, integrationId));
  }

  return { events: processed, reset: resetUsed };
}
