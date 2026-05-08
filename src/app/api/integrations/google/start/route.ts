import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import { requireOrg } from "@/lib/org";
import { buildAuthUrl } from "@/lib/calendar/google";

/**
 * Kick off the Google Calendar OAuth flow.
 *
 * `state` is `${nonce}.${orgId}.${hmac}` so the callback route can verify the
 * caller without round-tripping through the DB. HMAC is keyed off
 * `NEXTAUTH_SECRET` (or `AUTH_SECRET`).
 */
export function buildState(orgId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "smartline-dev";
  const hmac = createHmac("sha256", secret).update(`${nonce}.${orgId}`).digest("hex");
  return `${nonce}.${orgId}.${hmac}`;
}

export async function GET(req: NextRequest) {
  try {
    const { org } = await requireOrg();

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "GOOGLE_OAUTH_CLIENT_ID not configured" },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const redirectUri =
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      `${appUrl}/api/integrations/google/callback`;

    const state = buildState(org.id);
    const url = buildAuthUrl({ clientId, redirectUri, state });

    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
