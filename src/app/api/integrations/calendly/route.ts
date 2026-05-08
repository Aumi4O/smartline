import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { calendarIntegrations } from "@/lib/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import {
  getCalendlyMe,
  createCalendlyWebhook,
  deleteCalendlyWebhook,
} from "@/lib/calendar/calendly";
import { logAuditEvent } from "@/lib/compliance/audit";

/** GET — return the connection status for this org's Calendly integration. */
export async function GET() {
  try {
    const { org } = await requireOrg();
    const row = await db.query.calendarIntegrations.findFirst({
      where: and(
        eq(calendarIntegrations.orgId, org.id),
        eq(calendarIntegrations.provider, "calendly")
      ),
    });

    if (!row || row.status !== "active") {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      schedulingUrl: row.calendlySchedulingUrl,
      webhookActive: !!row.calendlyWebhookUri,
      connectedAt: row.createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — connect Calendly. Body: { personalAccessToken: string }. */
export async function POST(req: NextRequest) {
  try {
    const { org, session } = await requireOrg();
    const body = (await req.json()) as { personalAccessToken?: string };
    const pat = body.personalAccessToken?.trim();

    if (!pat) {
      return NextResponse.json(
        { error: "personalAccessToken is required" },
        { status: 400 }
      );
    }

    const me = await getCalendlyMe(pat);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const callbackUrl = `${appUrl}/api/webhooks/calendly?org=${org.id}`;

    // Subscribe to invitee.created/canceled. Calendly returns a per-subscription
    // signing key we store (encrypted) and use later for HMAC verification.
    const subscription = await createCalendlyWebhook(pat, {
      userUri: me.uri,
      organizationUri: me.current_organization,
      callbackUrl,
    });

    // Upsert the integration row. If an old row exists, replace tokens/keys.
    const existing = await db.query.calendarIntegrations.findFirst({
      where: and(
        eq(calendarIntegrations.orgId, org.id),
        eq(calendarIntegrations.provider, "calendly")
      ),
    });

    const values = {
      orgId: org.id,
      provider: "calendly" as const,
      status: "active" as const,
      accessTokenCiphertext: encryptSecret(pat),
      refreshTokenCiphertext: null,
      tokenExpiresAt: null,
      calendlyUserUri: me.uri,
      calendlySchedulingUrl: me.scheduling_url,
      calendlyWebhookSigningKey: encryptSecret(subscription.signing_key),
      calendlyWebhookUri: subscription.uri,
      googleAccountEmail: null,
      googleCalendarId: null,
      googleWatchChannelId: null,
      googleWatchResourceId: null,
      googleWatchExpiresAt: null,
      googleSyncToken: null,
      metadata: { calendlyName: me.name, calendlyEmail: me.email },
      updatedAt: new Date(),
    };

    if (existing) {
      // Best-effort cleanup of any stale subscription.
      if (existing.calendlyWebhookUri && existing.accessTokenCiphertext) {
        try {
          const oldPat = decryptSecret(existing.accessTokenCiphertext);
          await deleteCalendlyWebhook(oldPat, existing.calendlyWebhookUri);
        } catch (err) {
          console.warn("[calendly] failed to remove old webhook", err);
        }
      }
      await db
        .update(calendarIntegrations)
        .set(values)
        .where(eq(calendarIntegrations.id, existing.id));
    } else {
      await db.insert(calendarIntegrations).values(values);
    }

    logAuditEvent(
      org.id,
      "integration.calendly.connected",
      "calendar_integration",
      undefined,
      session.user?.id,
      undefined,
      { schedulingUrl: me.scheduling_url }
    ).catch(() => {});

    return NextResponse.json({
      connected: true,
      schedulingUrl: me.scheduling_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE — disconnect: remove webhook subscription and zero the row. */
export async function DELETE() {
  try {
    const { org, session } = await requireOrg();

    const row = await db.query.calendarIntegrations.findFirst({
      where: and(
        eq(calendarIntegrations.orgId, org.id),
        eq(calendarIntegrations.provider, "calendly")
      ),
    });
    if (!row) {
      return NextResponse.json({ connected: false });
    }

    if (row.calendlyWebhookUri && row.accessTokenCiphertext) {
      try {
        const pat = decryptSecret(row.accessTokenCiphertext);
        await deleteCalendlyWebhook(pat, row.calendlyWebhookUri);
      } catch (err) {
        console.warn("[calendly] webhook teardown failed", err);
      }
    }

    await db
      .update(calendarIntegrations)
      .set({
        status: "revoked",
        accessTokenCiphertext: null,
        calendlyWebhookSigningKey: null,
        calendlyWebhookUri: null,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, row.id));

    logAuditEvent(
      org.id,
      "integration.calendly.disconnected",
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
