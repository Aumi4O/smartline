import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarIntegrations } from "@/lib/db/schema";
import { ensureCalendarTables } from "@/lib/db/ensure-calendar-tables";
import { encryptSecret } from "@/lib/crypto/secrets";
import {
  exchangeCodeForTokens,
  getUserInfo,
  watchEvents,
  listEvents,
  GoogleSyncTokenInvalid,
} from "@/lib/calendar/google";
import { upsertAppointmentFromGoogleEvent } from "@/lib/calendar/google-sync";
import { logAuditEvent } from "@/lib/compliance/audit";

/**
 * Google OAuth redirect target. Exchanges the auth code, persists tokens,
 * sets up an `events.watch` push channel, and runs an initial backfill
 * via `events.list` to capture upcoming bookings + obtain a sync token.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const integrationsPage = `${appUrl}/integrations`;

  if (errorParam) {
    return NextResponse.redirect(
      `${integrationsPage}?google=error&reason=${encodeURIComponent(errorParam)}`,
      { status: 303 }
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(`${integrationsPage}?google=error&reason=missing_params`, {
      status: 303,
    });
  }

  const orgId = verifyState(state);
  if (!orgId) {
    return NextResponse.redirect(`${integrationsPage}?google=error&reason=bad_state`, {
      status: 303,
    });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${integrationsPage}?google=error&reason=oauth_not_configured`,
      { status: 303 }
    );
  }
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${appUrl}/api/integrations/google/callback`;

  try {
    await ensureCalendarTables();
    const tokens = await exchangeCodeForTokens({
      clientId,
      clientSecret,
      redirectUri,
      code,
    });

    if (!tokens.refreshToken) {
      // Without a refresh token we can't keep this integration alive.
      // This usually means the user previously granted access — they need
      // to revoke at https://myaccount.google.com/permissions and retry.
      return NextResponse.redirect(
        `${integrationsPage}?google=error&reason=missing_refresh_token`,
        { status: 303 }
      );
    }

    const userInfo = await getUserInfo(tokens.accessToken);

    // Stand up a push channel pointing at our webhook.
    const channelId = randomUUID();
    const watchAddress = `${appUrl}/api/webhooks/google-calendar`;
    const channel = await watchEvents(tokens.accessToken, {
      calendarId: "primary",
      channelId,
      address: watchAddress,
      token: orgId,
    });

    // Initial backfill — pull recent + upcoming events and stash a sync token.
    const initial = await listEvents(tokens.accessToken, {
      calendarId: "primary",
      timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      showDeleted: true,
    });

    // Walk all pages to obtain the final nextSyncToken.
    let nextPage = initial.nextPageToken;
    let syncToken = initial.nextSyncToken;
    const events = [...initial.items];
    while (nextPage && !syncToken) {
      const next = await listEvents(tokens.accessToken, {
        calendarId: "primary",
        pageToken: nextPage,
      });
      events.push(...next.items);
      nextPage = next.nextPageToken;
      syncToken = next.nextSyncToken;
    }

    const existing = await db.query.calendarIntegrations.findFirst({
      where: and(
        eq(calendarIntegrations.orgId, orgId),
        eq(calendarIntegrations.provider, "google")
      ),
    });

    const values = {
      orgId,
      provider: "google" as const,
      status: "active" as const,
      accessTokenCiphertext: encryptSecret(tokens.accessToken),
      refreshTokenCiphertext: encryptSecret(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      calendlyUserUri: null,
      calendlySchedulingUrl: null,
      calendlyWebhookSigningKey: null,
      calendlyWebhookUri: null,
      googleAccountEmail: userInfo.email,
      googleCalendarId: "primary",
      googleWatchChannelId: channel.id,
      googleWatchResourceId: channel.resourceId,
      googleWatchExpiresAt: channel.expiration ? new Date(parseInt(channel.expiration, 10)) : null,
      googleSyncToken: syncToken ?? null,
      metadata: { name: userInfo.name, sub: userInfo.sub },
      updatedAt: new Date(),
    };

    let integrationId: string;
    if (existing) {
      await db
        .update(calendarIntegrations)
        .set(values)
        .where(eq(calendarIntegrations.id, existing.id));
      integrationId = existing.id;
    } else {
      const [row] = await db
        .insert(calendarIntegrations)
        .values(values)
        .returning({ id: calendarIntegrations.id });
      integrationId = row.id;
    }

    // Persist initial events as appointments.
    for (const evt of events) {
      try {
        await upsertAppointmentFromGoogleEvent(orgId, integrationId, evt);
      } catch (err) {
        console.warn("[google callback] backfill upsert failed", err);
      }
    }

    logAuditEvent(
      orgId,
      "integration.google.connected",
      "calendar_integration",
      integrationId,
      undefined,
      undefined,
      { email: userInfo.email, eventsBackfilled: events.length }
    ).catch(() => {});

    return NextResponse.redirect(`${integrationsPage}?google=connected`, { status: 303 });
  } catch (err) {
    if (err instanceof GoogleSyncTokenInvalid) {
      return NextResponse.redirect(`${integrationsPage}?google=error&reason=sync_token`, {
        status: 303,
      });
    }
    console.error("[google callback] failed:", err);
    const reason = err instanceof Error ? err.message.slice(0, 80) : "unknown";
    return NextResponse.redirect(
      `${integrationsPage}?google=error&reason=${encodeURIComponent(reason)}`,
      { status: 303 }
    );
  }
}

function verifyState(state: string): string | null {
  const [nonce, orgId, signature] = state.split(".");
  if (!nonce || !orgId || !signature) return null;
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "smartline-dev";
  const expected = createHmac("sha256", secret).update(`${nonce}.${orgId}`).digest("hex");
  if (expected.length !== signature.length) return null;
  try {
    const ok = timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    return ok ? orgId : null;
  } catch {
    return null;
  }
}
