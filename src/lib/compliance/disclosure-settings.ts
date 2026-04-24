import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { hasConsent, grantConsent } from "@/lib/compliance/consent";

export type DisclosureMode = "always" | "first_call" | "never";
export const DEFAULT_DISCLOSURE_MODE: DisclosureMode = "first_call";

/**
 * Make sure the organizations.recording_disclosure_mode column exists.
 * Runs once per cold boot; no-op if the column is already there.
 *
 * We use raw SQL instead of adding the column to the drizzle schema so that
 * Vercel deploys don't require a manual `drizzle-kit push` step — the first
 * read/write in prod creates it automatically.
 */
let ensurePromise: Promise<void> | null = null;
export function ensureDisclosureColumn(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = db
      .execute(
        sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS recording_disclosure_mode TEXT DEFAULT 'first_call'`
      )
      .then(() => undefined)
      .catch((err) => {
        // Log but don't crash — reads fall back to DEFAULT_DISCLOSURE_MODE.
        console.error("[disclosure-settings] ALTER TABLE failed:", err);
      });
  }
  return ensurePromise;
}

export async function getDisclosureMode(orgId: string): Promise<DisclosureMode> {
  await ensureDisclosureColumn();
  try {
    // drizzle's postgres-js driver returns rows as an array-like directly
    // (no `.rows` wrapper, unlike node-postgres).
    const res = (await db.execute(
      sql`SELECT recording_disclosure_mode FROM organizations WHERE id = ${orgId} LIMIT 1`
    )) as unknown as Array<{ recording_disclosure_mode?: string | null }>;
    const row = Array.isArray(res) ? res[0] : undefined;
    const val = row?.recording_disclosure_mode;
    if (val === "always" || val === "first_call" || val === "never") return val;
  } catch (err) {
    console.error("[disclosure-settings] getDisclosureMode failed:", err);
  }
  return DEFAULT_DISCLOSURE_MODE;
}

export async function setDisclosureMode(
  orgId: string,
  mode: DisclosureMode
): Promise<void> {
  await ensureDisclosureColumn();
  await db.execute(
    sql`UPDATE organizations SET recording_disclosure_mode = ${mode}, updated_at = NOW() WHERE id = ${orgId}`
  );
}

/**
 * Decides whether to play the "this call may be recorded" TwiML `<Say>`
 * for a given inbound caller.
 *
 * - always     → always true
 * - first_call → true only if we don't already have a recording-consent
 *                record for this caller phone (the consent is granted
 *                on first call, so this effectively means "first call
 *                per caller").
 * - never      → always false (customer accepted legal responsibility in UI)
 */
export async function shouldPlayDisclosure(
  orgId: string,
  callerPhone: string
): Promise<boolean> {
  const mode = await getDisclosureMode(orgId);
  if (mode === "never") return false;
  if (mode === "always") return true;
  if (!callerPhone) return true;
  try {
    const consented = await hasConsent(orgId, callerPhone, "recording");
    return !consented;
  } catch {
    return true;
  }
}

/**
 * Grants recording consent idempotently. Safe to call on every call; the
 * underlying `grantConsent` skips if a consent record already exists.
 */
export async function recordDisclosureConsent(
  orgId: string,
  callerPhone: string,
  source: string
): Promise<void> {
  if (!callerPhone) return;
  try {
    await grantConsent(orgId, callerPhone, "recording", source);
  } catch (err) {
    console.error("[disclosure-settings] recordDisclosureConsent failed:", err);
  }
}
