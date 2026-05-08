import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { calendarIntegrations } from "@/lib/db/schema";
import { stopChannel } from "@/lib/calendar/google";
import { getFreshGoogleAccessToken } from "@/lib/calendar/google-tokens";
import { logAuditEvent } from "@/lib/compliance/audit";

/** GET — return the current org's Google Calendar connection status. */
export async function GET() {
  try {
    const { org } = await requireOrg();
    const row = await db.query.calendarIntegrations.findFirst({
      where: and(
        eq(calendarIntegrations.orgId, org.id),
        eq(calendarIntegrations.provider, "google")
      ),
    });

    if (!row || row.status !== "active") {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      email: row.googleAccountEmail,
      calendarId: row.googleCalendarId,
      watchExpiresAt: row.googleWatchExpiresAt,
      connectedAt: row.createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — stop the watch channel and revoke the row. */
export async function DELETE() {
  try {
    const { org, session } = await requireOrg();

    const row = await db.query.calendarIntegrations.findFirst({
      where: and(
        eq(calendarIntegrations.orgId, org.id),
        eq(calendarIntegrations.provider, "google")
      ),
    });

    if (!row) {
      return NextResponse.json({ connected: false });
    }

    if (row.googleWatchChannelId && row.googleWatchResourceId) {
      try {
        const accessToken = await getFreshGoogleAccessToken(row.id);
        await stopChannel(accessToken, {
          channelId: row.googleWatchChannelId,
          resourceId: row.googleWatchResourceId,
        });
      } catch (err) {
        console.warn("[google disconnect] channels.stop failed:", err);
      }
    }

    await db
      .update(calendarIntegrations)
      .set({
        status: "revoked",
        accessTokenCiphertext: null,
        refreshTokenCiphertext: null,
        tokenExpiresAt: null,
        googleWatchChannelId: null,
        googleWatchResourceId: null,
        googleWatchExpiresAt: null,
        googleSyncToken: null,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, row.id));

    logAuditEvent(
      org.id,
      "integration.google.disconnected",
      "calendar_integration",
      row.id,
      session.user?.id
    ).catch(() => {});

    return NextResponse.json({ connected: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
