import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarIntegrations } from "@/lib/db/schema";
import { syncGoogleCalendar } from "@/lib/calendar/google-sync";

/**
 * Google Calendar push notification receiver.
 *
 * Google POSTs to this URL with these headers (no body):
 *   X-Goog-Channel-ID, X-Goog-Channel-Token, X-Goog-Resource-ID,
 *   X-Goog-Resource-State (sync|exists|not_exists), X-Goog-Message-Number.
 *
 * On `sync` (the initial handshake) we just acknowledge.
 * On `exists` we run an incremental events.list using the stored sync token.
 *
 * Verification: we check that the channel-token matches the orgId we stored
 * during the OAuth callback (we set `token: orgId` in events.watch).
 */
export async function POST(req: NextRequest) {
  try {
    const channelId = req.headers.get("x-goog-channel-id");
    const channelToken = req.headers.get("x-goog-channel-token");
    const resourceState = req.headers.get("x-goog-resource-state");

    if (!channelId) {
      return NextResponse.json({ received: true });
    }

    if (resourceState === "sync") {
      // Initial handshake — nothing to do.
      return NextResponse.json({ received: true });
    }

    const integration = await db.query.calendarIntegrations.findFirst({
      where: eq(calendarIntegrations.googleWatchChannelId, channelId),
    });

    if (!integration || integration.provider !== "google" || integration.status !== "active") {
      // Channel is unknown or revoked — ignore quietly.
      return NextResponse.json({ received: true });
    }

    if (channelToken && channelToken !== integration.orgId) {
      return NextResponse.json({ received: true });
    }

    await syncGoogleCalendar(integration.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[google webhook] error:", error);
    // Always 200 so Google doesn't retry-storm.
    return NextResponse.json({ received: true });
  }
}
