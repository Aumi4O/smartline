import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getCallHistory } from "@/lib/calls/call-handler";

export async function GET() {
  try {
    const { org } = await requireOrg();
    const calls = await getCallHistory(org.id);

    return NextResponse.json({
      calls: calls.map((c) => ({
        id: c.id,
        agentName: c.agent?.name || "Unknown",
        channel: c.channel,
        callerPhone: c.callerPhone,
        status: c.status,
        summary: c.summary,
        durationSec: c.durationSec,
        costCents: c.costCents,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
