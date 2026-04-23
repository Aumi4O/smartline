import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { parseCSV, normalizePhone, detectTimezone } from "@/lib/campaigns/csv-parser";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { org } = await requireOrg();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const campaignId = url.searchParams.get("campaignId");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);

    const conditions = [eq(leads.orgId, org.id)];
    if (status) conditions.push(eq(leads.status, status));
    if (campaignId) conditions.push(eq(leads.campaignId, campaignId));

    const rows = await db.query.leads.findMany({
      where: and(...conditions),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
      limit,
    });

    const [stats] = await db
      .select({
        total: count(),
        newCount: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'new')`,
        calledCount: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} IN ('completed', 'voicemail', 'no_answer'))`,
        interestedCount: sql<number>`COUNT(*) FILTER (WHERE ${leads.outcome} = 'interested')`,
      })
      .from(leads)
      .where(eq(leads.orgId, org.id));

    return NextResponse.json({ leads: rows, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { org } = await requireOrg();

    const rl = await rateLimit(org.id, "api");
    if (!rl.success) return rateLimitResponse(rl.reset);

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      const csvText = await req.text();
      const { leads: parsed, errors } = parseCSV(csvText);

      if (parsed.length === 0) {
        return NextResponse.json({ error: "No valid leads found", errors }, { status: 400 });
      }

      const campaignId = new URL(req.url).searchParams.get("campaignId") || undefined;

      const rows = await db
        .insert(leads)
        .values(
          parsed.map((l) => ({
            orgId: org.id,
            campaignId: campaignId || undefined,
            firstName: l.firstName,
            lastName: l.lastName,
            phone: l.phone,
            email: l.email,
            company: l.company,
            notes: l.notes,
            timezone: l.timezone,
            consentGranted: true,
          }))
        )
        .onConflictDoNothing()
        .returning();

      return NextResponse.json({
        imported: rows.length,
        skipped: parsed.length - rows.length,
        errors,
      });
    }

    const body = await req.json();
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const [lead] = await db
      .insert(leads)
      .values({
        orgId: org.id,
        campaignId: body.campaignId || undefined,
        firstName: body.firstName,
        lastName: body.lastName,
        phone,
        email: body.email,
        company: body.company,
        notes: body.notes,
        timezone: body.timezone || detectTimezone(phone),
        consentGranted: body.consentGranted ?? true,
      })
      .returning();

    return NextResponse.json({ lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { org } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await db.delete(leads).where(and(eq(leads.id, id), eq(leads.orgId, org.id)));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
