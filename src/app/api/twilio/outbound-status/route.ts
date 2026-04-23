import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { processCallEnd } from "@/lib/calls/post-call";
import { updateCampaignProgress } from "@/lib/campaigns/campaign-engine";
import { conversations } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

/**
 * Twilio outbound call status callback.
 * Updates lead status based on call outcome and triggers post-call processing.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId") || "";
    const leadId = url.searchParams.get("leadId") || "";

    const formData = await req.formData();
    const callStatus = (formData.get("CallStatus") as string) || "";
    const callDuration = parseInt((formData.get("CallDuration") as string) || "0", 10);
    const callSid = (formData.get("CallSid") as string) || "";

    if (callStatus === "completed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
      if (leadId) {
        let leadStatus = "completed";
        let outcome: string | undefined;

        if (callStatus === "no-answer" || callStatus === "busy") {
          leadStatus = "no_answer";
          outcome = "no_answer";
        } else if (callStatus === "failed") {
          leadStatus = "failed";
          outcome = "failed";
        } else if (callDuration > 0) {
          leadStatus = "completed";
        }

        await db
          .update(leads)
          .set({
            status: leadStatus,
            outcome: outcome || undefined,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, leadId));
      }

      if (callDuration > 0) {
        const conv = await db.query.conversations.findFirst({
          where: sql`${conversations.metadata}->>'callSid' = ${callSid}`,
        });

        if (conv && conv.status === "active") {
          await processCallEnd(conv.id, conv.orgId, callDuration, []);
        }
      }

      if (campaignId) {
        updateCampaignProgress(campaignId).catch(() => {});
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Outbound status error:", error);
    return NextResponse.json({ received: true });
  }
}
