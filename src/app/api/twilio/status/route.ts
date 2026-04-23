import { NextRequest, NextResponse } from "next/server";
import { processCallEnd } from "@/lib/calls/post-call";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Twilio status callback — called when a call ends or changes status.
 * Used for post-call processing: calculate cost, deduct credits, save summary.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string || "";
    const callStatus = formData.get("CallStatus") as string || "";
    const callDuration = formData.get("CallDuration") as string || "0";

    console.log(`Call status: ${callSid} → ${callStatus} (${callDuration}s)`);

    if (callStatus === "completed" && parseInt(callDuration) > 0) {
      const conv = await db.query.conversations.findFirst({
        where: sql`${conversations.metadata}->>'callSid' = ${callSid}`,
      });

      if (conv && conv.status === "active") {
        await processCallEnd(
          conv.id,
          conv.orgId,
          parseInt(callDuration),
          []
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Status callback error:", error);
    return NextResponse.json({ received: true });
  }
}
