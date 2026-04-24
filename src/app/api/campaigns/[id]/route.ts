import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { campaigns, leads } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { processCampaignBatch } from "@/lib/campaigns/campaign-engine";
import { logAuditEvent } from "@/lib/compliance/audit";
import { parseSchedule } from "@/lib/campaigns/schedule";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await requireOrg();

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.orgId, org.id)),
      with: { agent: true, callFromNumber: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const [stats] = await db
      .select({
        total: count(),
        newLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'new')`,
        queued: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'queued')`,
        calling: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'calling')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'completed')`,
        voicemail: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'voicemail')`,
        noAnswer: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'no_answer')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'failed')`,
        interested: sql<number>`COUNT(*) FILTER (WHERE ${leads.outcome} = 'interested')`,
        notInterested: sql<number>`COUNT(*) FILTER (WHERE ${leads.outcome} = 'not_interested')`,
        callback: sql<number>`COUNT(*) FILTER (WHERE ${leads.outcome} = 'callback')`,
      })
      .from(leads)
      .where(eq(leads.campaignId, id));

    return NextResponse.json({ campaign, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await requireOrg();
    const body = await req.json();

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.orgId, org.id)),
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (body.action === "start") {
      await db
        .update(campaigns)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(campaigns.id, id));

      await db
        .update(leads)
        .set({ status: "queued", updatedAt: new Date() })
        .where(and(eq(leads.campaignId, id), eq(leads.status, "new")));

      processCampaignBatch(id).catch((e) =>
        console.error(`Campaign batch error: ${e}`)
      );

      logAuditEvent(org.id, "campaign.started", "campaign", id).catch(() => {});

      return NextResponse.json({ status: "active" });
    }

    if (body.action === "pause") {
      await db
        .update(campaigns)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(campaigns.id, id));
      logAuditEvent(org.id, "campaign.paused", "campaign", id).catch(() => {});
      return NextResponse.json({ status: "paused" });
    }

    if (body.action === "stop") {
      await db
        .update(campaigns)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(campaigns.id, id));
      logAuditEvent(org.id, "campaign.stopped", "campaign", id).catch(() => {});
      return NextResponse.json({ status: "completed" });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name) updates.name = body.name;
    if (body.outboundPrompt !== undefined) updates.outboundPrompt = body.outboundPrompt;
    if (body.maxCallsPerHour) updates.maxCallsPerHour = body.maxCallsPerHour;
    if (body.voicemailAction) updates.voicemailAction = body.voicemailAction;
    if (body.voicemailMessage !== undefined) updates.voicemailMessage = body.voicemailMessage;
    if (body.schedule !== undefined) {
      updates.schedule = parseSchedule(body.schedule);
    }

    await db.update(campaigns).set(updates).where(eq(campaigns.id, id));
    return NextResponse.json({ updated: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await requireOrg();
    await db.delete(leads).where(eq(leads.campaignId, id));
    await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.orgId, org.id)));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
