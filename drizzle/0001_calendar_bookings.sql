CREATE TABLE "appointments" (
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
);
--> statement-breakpoint
CREATE TABLE "calendar_integrations" (
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
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_integration_id_calendar_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."calendar_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_provider_event" ON "appointments" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_org_starts" ON "appointments" USING btree ("org_id","starts_at");--> statement-breakpoint
CREATE INDEX "idx_appointments_lead" ON "appointments" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_integrations_org_provider" ON "calendar_integrations" USING btree ("org_id","provider");--> statement-breakpoint
CREATE INDEX "idx_calendar_integrations_channel" ON "calendar_integrations" USING btree ("google_watch_channel_id");