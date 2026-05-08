import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Self-healing migration for the calendar/appointments schema.
//
// On serverless we can't rely on a separate migration step running between
// "code deployed" and "page rendered". This helper checks whether the new
// tables exist and, if missing, creates them idempotently. Cached per
// Lambda instance with a short TTL so warm requests skip the round trip.
//
// Each DDL statement is sent separately because the pgbouncer transaction
// pooler (port 6543 on Supabase) is finicky about multi-statement queries.

let ensuredAt: number | null = null;
const TTL_MS = 10 * 60 * 1000;

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "calendar_integrations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid NOT NULL,
    "provider" text NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "access_token_ciphertext" text,
    "refresh_token_ciphertext" text,
    "token_expires_at" timestamp with time zone,
    "calendly_user_uri" text,
    "calendly_scheduling_url" text,
    "calendly_webhook_signing_key" text,
    "calendly_webhook_uri" text,
    "google_account_email" text,
    "google_calendar_id" text DEFAULT 'primary',
    "google_watch_channel_id" text,
    "google_watch_resource_id" text,
    "google_watch_expires_at" timestamp with time zone,
    "google_sync_token" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "appointments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid NOT NULL,
    "integration_id" uuid NOT NULL,
    "provider" text NOT NULL,
    "external_event_id" text NOT NULL,
    "external_event_uri" text,
    "lead_id" uuid,
    "conversation_id" uuid,
    "title" text,
    "description" text,
    "status" text DEFAULT 'confirmed' NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "timezone" text,
    "attendee_name" text,
    "attendee_email" text,
    "attendee_phone" text,
    "location" text,
    "join_url" text,
    "cancel_url" text,
    "reschedule_url" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_integrations_org_id_organizations_id_fk') THEN
      ALTER TABLE "calendar_integrations"
        ADD CONSTRAINT "calendar_integrations_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_org_id_organizations_id_fk') THEN
      ALTER TABLE "appointments"
        ADD CONSTRAINT "appointments_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_integration_id_calendar_integrations_id_fk') THEN
      ALTER TABLE "appointments"
        ADD CONSTRAINT "appointments_integration_id_calendar_integrations_id_fk"
        FOREIGN KEY ("integration_id") REFERENCES "public"."calendar_integrations"("id") ON DELETE CASCADE;
    END IF;
  END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "calendar_integrations_org_provider"
    ON "calendar_integrations" ("org_id", "provider")`,
  `CREATE INDEX IF NOT EXISTS "idx_calendar_integrations_channel"
    ON "calendar_integrations" ("google_watch_channel_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "appointments_provider_event"
    ON "appointments" ("provider", "external_event_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_appointments_org_starts"
    ON "appointments" ("org_id", "starts_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_appointments_lead"
    ON "appointments" ("lead_id")`,
];

export async function ensureCalendarTables(): Promise<void> {
  if (ensuredAt && Date.now() - ensuredAt < TTL_MS) return;
  try {
    for (const stmt of STATEMENTS) {
      await db.execute(sql.raw(stmt));
    }
    ensuredAt = Date.now();
  } catch (err) {
    // Don't crash the page if DDL fails; let the underlying query throw a
    // more specific error and surface it in logs.
    console.error("[ensureCalendarTables] failed:", err);
  }
}
