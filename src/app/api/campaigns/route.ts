import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
    const { org } = await requireOrg();
    const rows = await db.query.campaigns.findMany({
      where: eq(campaigns.orgId, org.id),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      with: { agent: true, callFromNumber: true },
    });

    return NextResponse.json({
      campaigns: rows.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        agentName: c.agent?.name || "—",
        phoneNumber: c.callFromNumber?.phoneNumber || "—",
        totalLeads: c.totalLeads,
        completedLeads: c.completedLeads,
        maxCallsPerHour: c.maxCallsPerHour,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { org } = await requireOrg();
    const body = await req.json();

    if (!body.name || !body.agentId) {
      return NextResponse.json({ error: "Name and agent are required" }, { status: 400 });
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        orgId: org.id,
        agentId: body.agentId,
        name: body.name,
        outboundPrompt: body.outboundPrompt || "",
        callFromNumberId: body.callFromNumberId || null,
        schedule: body.schedule || { startTime: "09:00", endTime: "17:00", days: [1, 2, 3, 4, 5] },
        maxConcurrent: body.maxConcurrent || 1,
        maxCallsPerHour: body.maxCallsPerHour || 30,
        voicemailAction: body.voicemailAction || "leave_message",
        voicemailMessage: body.voicemailMessage || "",
        retryDelayMinutes: body.retryDelayMinutes || 60,
        maxAttempts: body.maxAttempts || 3,
      })
      .returning();

    return NextResponse.json({ campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
