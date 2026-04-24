import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseIntakeToken } from "@/lib/leads/intake-token";
import { normalizeInboundLead } from "@/lib/leads/normalizer";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/compliance/audit";

/**
 * Public per-org lead intake.
 *
 * URL:   POST /api/public/leads/{token}
 * Token: {orgId}.{hmac12} produced by generateIntakeToken()
 *
 * Accepts:
 *   - Generic JSON: { phone, email, first_name, last_name, company, segment?, source? }
 *   - Facebook Lead Ads (flattened via Zapier/Make): { full_name, phone_number, email, form_name }
 *   - Facebook Lead Ads raw: { field_data: [...], form_id, ad_id }
 *   - HubSpot / Salesforce webhooks with a top-level `properties` object
 *
 * The normalizer picks the best value for each canonical field and
 * preserves everything else under `customFields.raw` so nothing is lost.
 *
 * Rate limited at the org level so a misconfigured CRM can't brownout us.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { orgId, valid } = parseIntakeToken(token);
  if (!valid) {
    return NextResponse.json({ error: "Invalid intake token" }, { status: 401 });
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const rl = await rateLimit(orgId, "api");
  if (!rl.success) return rateLimitResponse(rl.reset);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  const normalized = normalizeInboundLead(body as Record<string, unknown>);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId") || undefined;

  const [lead] = await db
    .insert(leads)
    .values({
      orgId,
      campaignId,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      phone: normalized.phone,
      email: normalized.email,
      company: normalized.company,
      notes: normalized.notes,
      timezone: normalized.timezone,
      consentGranted: true,
      customFields: normalized.customFields,
    })
    .onConflictDoNothing()
    .returning();

  logAuditEvent(
    orgId,
    "lead.intake",
    "lead",
    lead?.id || normalized.phone,
    undefined,
    undefined,
    { source: normalized.source, campaignId: campaignId || null }
  ).catch(() => {});

  return NextResponse.json(
    {
      ok: true,
      id: lead?.id ?? null,
      duplicate: !lead,
      source: normalized.source,
    },
    { status: lead ? 201 : 200 }
  );
}

/** Lightweight health probe so integrations can test the URL without side effects. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { orgId, valid } = parseIntakeToken(token);
  if (!valid) {
    return NextResponse.json({ error: "Invalid intake token" }, { status: 401 });
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    org: { id: org.id, name: org.name },
    method: "POST",
    expects: "application/json",
    examples: [
      { phone: "+15551234567", email: "jane@example.com", first_name: "Jane", last_name: "Doe" },
      {
        full_name: "Jane Doe",
        phone_number: "+15551234567",
        email: "jane@example.com",
        form_name: "Facebook Oct Campaign",
      },
    ],
  });
}
