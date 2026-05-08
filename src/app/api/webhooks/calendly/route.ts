import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  calendarIntegrations,
  appointments,
  leads,
} from "@/lib/db/schema";
import { decryptSecret } from "@/lib/crypto/secrets";
import { logAuditEvent } from "@/lib/compliance/audit";

/**
 * Calendly v2 webhook receiver.
 *
 * Calendly signs payloads with HMAC-SHA256 in the
 * `Calendly-Webhook-Signature` header, formatted as
 *   `t=<unix_seconds>,v1=<hex_hmac>`
 * where the signed string is `<unix_seconds>.<raw_request_body>`.
 *
 * We look up the org via the `?org=<id>` query param we set when creating
 * the subscription. Per-org `signing_key` is decrypted and used for HMAC.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("org");
    if (!orgId) {
      return NextResponse.json({ error: "Missing org" }, { status: 400 });
    }

    const integration = await db.query.calendarIntegrations.findFirst({
      where: and(
        eq(calendarIntegrations.orgId, orgId),
        eq(calendarIntegrations.provider, "calendly"),
        eq(calendarIntegrations.status, "active")
      ),
    });
    if (!integration?.calendlyWebhookSigningKey) {
      return NextResponse.json({ error: "Not connected" }, { status: 404 });
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.get("calendly-webhook-signature") || "";

    if (!verifyCalendlySignature(rawBody, signatureHeader, decryptSecret(integration.calendlyWebhookSigningKey))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as CalendlyWebhookPayload;
    const event = payload?.event;

    if (event === "invitee.created") {
      await upsertAppointmentFromCalendly(orgId, integration.id, payload, "confirmed");
    } else if (event === "invitee.canceled") {
      await upsertAppointmentFromCalendly(orgId, integration.id, payload, "canceled");
    }

    logAuditEvent(orgId, `calendly.${event}`, "appointment", undefined, undefined, undefined, {
      eventUri: payload?.payload?.event?.uri,
    }).catch(() => {});

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[calendly webhook] error:", error);
    // Always 200 to avoid Calendly retry storms once we've already accepted.
    // If signature failed we already returned 401 above.
    return NextResponse.json({ received: true });
  }
}

function verifyCalendlySignature(
  rawBody: string,
  header: string,
  signingKey: string
): boolean {
  // Format: t=1234567890,v1=abcdef...
  const parts = header.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.trim().split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {});

  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const ageMs = Math.abs(Date.now() - parseInt(t, 10) * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  const expected = createHmac("sha256", signingKey).update(`${t}.${rawBody}`).digest("hex");

  if (expected.length !== v1.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(v1, "utf8"));
}

interface CalendlyWebhookPayload {
  event: "invitee.created" | "invitee.canceled" | string;
  payload: {
    uri?: string;
    name?: string;
    email?: string;
    text_reminder_number?: string | null;
    timezone?: string;
    cancel_url?: string;
    reschedule_url?: string;
    status?: string;
    event?: {
      uri?: string;
      name?: string;
      start_time?: string;
      end_time?: string;
      location?: { type?: string; location?: string; join_url?: string } | null;
    };
    questions_and_answers?: Array<{ question: string; answer: string }>;
  };
}

async function upsertAppointmentFromCalendly(
  orgId: string,
  integrationId: string,
  payload: CalendlyWebhookPayload,
  status: "confirmed" | "canceled"
) {
  const p = payload.payload || {};
  const evt = p.event || {};
  const externalEventId =
    evt.uri || p.uri || `unknown-${Date.now()}`;

  const phoneFromQA = (p.questions_and_answers || []).find((qa) =>
    /phone|mobile|cell/i.test(qa.question)
  )?.answer;

  const attendeePhone = p.text_reminder_number || phoneFromQA || null;
  const attendeeEmail = p.email || null;

  let leadId: string | null = null;
  if (attendeePhone || attendeeEmail) {
    const matchByPhone = attendeePhone
      ? await db.query.leads.findFirst({
          where: and(eq(leads.orgId, orgId), eq(leads.phone, attendeePhone)),
        })
      : null;
    const matchByEmail = !matchByPhone && attendeeEmail
      ? await db.query.leads.findFirst({
          where: and(eq(leads.orgId, orgId), eq(leads.email, attendeeEmail)),
        })
      : null;
    leadId = matchByPhone?.id || matchByEmail?.id || null;
  }

  const startsAt = evt.start_time ? new Date(evt.start_time) : null;
  const endsAt = evt.end_time ? new Date(evt.end_time) : null;

  const location = evt.location?.location || evt.location?.type || null;
  const joinUrl = evt.location?.join_url || null;

  const existing = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.provider, "calendly"),
      eq(appointments.externalEventId, externalEventId)
    ),
  });

  const values = {
    orgId,
    integrationId,
    provider: "calendly" as const,
    externalEventId,
    externalEventUri: evt.uri || null,
    leadId,
    title: evt.name || "Calendly meeting",
    description: null,
    status,
    startsAt,
    endsAt,
    timezone: p.timezone || null,
    attendeeName: p.name || null,
    attendeeEmail,
    attendeePhone,
    location,
    joinUrl,
    cancelUrl: p.cancel_url || null,
    rescheduleUrl: p.reschedule_url || null,
    metadata: {
      questionsAndAnswers: p.questions_and_answers || [],
    },
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(appointments)
      .set(values)
      .where(eq(appointments.id, existing.id));
  } else {
    await db.insert(appointments).values(values);
  }
}
