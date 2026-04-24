import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/compliance/audit";
import {
  getDisclosureMode,
  setDisclosureMode,
  DisclosureMode,
} from "@/lib/compliance/disclosure-settings";

export async function GET() {
  try {
    const { org } = await requireOrg();
    const recordingDisclosureMode = await getDisclosureMode(org.id);
    return NextResponse.json({
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      planStatus: org.planStatus,
      dataRetentionDays: org.dataRetentionDays,
      recordingDisclosureMode,
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

    let nextDisclosureMode: DisclosureMode | undefined;
    if (
      body.recordingDisclosureMode === "always" ||
      body.recordingDisclosureMode === "first_call" ||
      body.recordingDisclosureMode === "never"
    ) {
      nextDisclosureMode = body.recordingDisclosureMode;
    }

    const [updated] = await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, org.id))
      .returning();

    if (nextDisclosureMode) {
      await setDisclosureMode(org.id, nextDisclosureMode);
    }

    logAuditEvent(
      org.id,
      "settings.updated",
      "organization",
      org.id,
      session.user!.id!,
      undefined,
      { ...updates, recordingDisclosureMode: nextDisclosureMode }
    ).catch(() => {});

    const recordingDisclosureMode =
      nextDisclosureMode ?? (await getDisclosureMode(org.id));
    return NextResponse.json({
      name: updated.name,
      dataRetentionDays: updated.dataRetentionDays,
      recordingDisclosureMode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
