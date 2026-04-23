import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getCallDetail } from "@/lib/calls/call-handler";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await requireOrg();
    const call = await getCallDetail(id, org.id);

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    return NextResponse.json({
      call: {
        id: call.id,
        agentName: call.agent?.name || "Unknown",
        channel: call.channel,
        callerPhone: call.callerPhone,
        status: call.status,
        summary: call.summary,
        sentiment: call.sentiment,
        leadScore: call.leadScore,
        durationSec: call.durationSec,
        costCents: call.costCents,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
      },
      messages: (call.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
