import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/compliance/audit";

export async function GET() {
  try {
    const { org } = await requireOrg();
    return NextResponse.json({
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      planStatus: org.planStatus,
      dataRetentionDays: org.dataRetentionDays,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { session, org } = await requireOrg();
    const body = await req.json();

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name && typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (body.dataRetentionDays && [30, 60, 90, 365].includes(body.dataRetentionDays)) {
      updates.dataRetentionDays = body.dataRetentionDays;
    }

    const [updated] = await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, org.id))
      .returning();

    logAuditEvent(org.id, "settings.updated", "organization", org.id, session.user!.id!, undefined, updates).catch(() => {});

    return NextResponse.json({ name: updated.name, dataRetentionDays: updated.dataRetentionDays });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
