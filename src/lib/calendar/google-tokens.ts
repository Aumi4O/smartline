import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarIntegrations } from "@/lib/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { refreshAccessToken } from "@/lib/calendar/google";

/**
 * Ensure a non-expired Google access token for a given calendar_integrations row.
 * Refreshes via the stored refresh token when expiry is within 60s, persists
 * the new access token + expiry, and returns the live access token string.
 */
export async function getFreshGoogleAccessToken(
  integrationId: string
): Promise<string> {
  const row = await db.query.calendarIntegrations.findFirst({
    where: eq(calendarIntegrations.id, integrationId),
  });
  if (!row) throw new Error("Calendar integration not found");
  if (row.provider !== "google") throw new Error("Not a Google integration");
  if (!row.accessTokenCiphertext || !row.refreshTokenCiphertext) {
    throw new Error("Google integration missing tokens");
  }

  const accessToken = decryptSecret(row.accessTokenCiphertext);
  const refreshToken = decryptSecret(row.refreshTokenCiphertext);

  const exp = row.tokenExpiresAt;
  const skewMs = 60_000;
  const stillFresh = exp && exp.getTime() - Date.now() > skewMs;
  if (stillFresh) return accessToken;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not configured");
  }

  const refreshed = await refreshAccessToken({
    clientId,
    clientSecret,
    refreshToken,
  });

  await db
    .update(calendarIntegrations)
    .set({
      accessTokenCiphertext: encryptSecret(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(calendarIntegrations.id, integrationId));

  return refreshed.accessToken;
}
