import crypto from "crypto";

/**
 * Per-org, public-but-unguessable intake token.
 *
 * Design goals:
 *   - No schema migration (tokens are derived, not stored).
 *   - Stable across deploys so customers can paste them into Zapier/FB/etc.
 *   - Revocable in bulk (rotate SMARTLINE_INTAKE_SECRET) if ever leaked.
 *   - Constant-time verification to avoid timing attacks.
 *
 * Format:  {orgId}.{hmac12}
 *   where hmac12 is the first 12 hex chars of HMAC_SHA256(secret, orgId).
 *
 * 12 hex chars = 48 bits of entropy → 2^48 guesses to forge one. Plenty
 * because we also rate-limit the public endpoint.
 */

function getSecret(): string {
  const secret =
    process.env.SMARTLINE_INTAKE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "SMARTLINE_INTAKE_SECRET is not set. Please configure it in your environment."
    );
  }
  return secret;
}

export function generateIntakeToken(orgId: string): string {
  const hmac = crypto
    .createHmac("sha256", getSecret())
    .update(orgId)
    .digest("hex")
    .slice(0, 12);
  return `${orgId}.${hmac}`;
}

export function parseIntakeToken(
  token: string
): { orgId: string; valid: boolean } {
  if (!token || !token.includes(".")) return { orgId: "", valid: false };
  const [orgId, sig] = token.split(".");
  if (!orgId || !sig || sig.length !== 12) {
    return { orgId: orgId || "", valid: false };
  }
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(orgId)
    .digest("hex")
    .slice(0, 12);

  let valid = false;
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }
  return { orgId, valid };
}
