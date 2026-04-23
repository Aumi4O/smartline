import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, campaigns, agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildCallConfig, createCallRecord } from "@/lib/calls/call-handler";
import { getRecordingDisclosure } from "@/lib/compliance/consent";

/**
 * Twilio outbound call webhook — called when an outbound call connects.
 * Returns TwiML to route the call to OpenAI via Media Streams.
 *
 * Handles AMD (Answering Machine Detection):
 * - Human answered → connect to AI agent
 * - Voicemail → play message or hang up based on campaign config
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId") || "";
    const leadId = url.searchParams.get("leadId") || "";

    const formData = await req.formData();
    const answeredBy = (formData.get("AnsweredBy") as string) || "human";
    const callSid = (formData.get("CallSid") as string) || "";
    const to = (formData.get("To") as string) || "";

    const campaign = campaignId
      ? await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) })
      : null;

    const lead = leadId
      ? await db.query.leads.findFirst({ where: eq(leads.id, leadId) })
      : null;

    const isVoicemail = answeredBy === "machine_start" || answeredBy === "machine_end_beep" || answeredBy === "machine_end_silence";

    if (isVoicemail) {
      const action = campaign?.voicemailAction || "leave_message";

      if (action === "hang_up") {
        if (lead) {
          await db.update(leads).set({ status: "voicemail", outcome: "voicemail", updatedAt: new Date() }).where(eq(leads.id, lead.id));
        }
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
          { headers: { "Content-Type": "text/xml" } }
        );
      }

      const vmMessage = campaign?.voicemailMessage
        || `Hi${lead?.firstName ? ` ${lead.firstName}` : ""}, this is a call from SmartLine. We'll try you again later, or you can call us back at your convenience. Thank you!`;

      if (lead) {
        await db.update(leads).set({ status: "voicemail", outcome: "voicemail", updatedAt: new Date() }).where(eq(leads.id, lead.id));
      }

      const clean = vmMessage.replace(/&/g, " and ").replace(/</g, "").replace(/>/g, "");
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="2"/>
  <Say voice="Polly.Joanna">${clean}</Say>
  <Hangup/>
</Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const orgId = campaign?.orgId || lead?.orgId;
    const agentId = campaign?.agentId;
    if (!orgId || !agentId) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, there was an error connecting this call. Goodbye.</Say>
  <Hangup/>
</Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const config = await buildCallConfig(orgId, agentId, to);

    let outboundContext = "";
    if (lead) {
      const parts = [];
      if (lead.firstName || lead.lastName) parts.push(`You are calling ${[lead.firstName, lead.lastName].filter(Boolean).join(" ")}.`);
      if (lead.company) parts.push(`They work at ${lead.company}.`);
      if (lead.notes) parts.push(`Context: ${lead.notes}`);
      outboundContext = parts.join(" ");
    }
    if (campaign?.outboundPrompt) {
      outboundContext = campaign.outboundPrompt + "\n" + outboundContext;
    }

    const fullPrompt = outboundContext
      ? `${config.systemPrompt}\n\nOUTBOUND CALL CONTEXT:\n${outboundContext}`
      : config.systemPrompt;

    const conversation = await createCallRecord(orgId, agentId, "phone", to, {
      callSid,
      direction: "outbound",
      campaignId,
      leadId,
    });

    if (lead) {
      await db.update(leads).set({ lastConversationId: conversation.id, updatedAt: new Date() }).where(eq(leads.id, lead.id));
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const wsUrl = appUrl.replace("https://", "wss://").replace("http://", "ws://");

    const disclosure = getRecordingDisclosure();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${disclosure}</Say>
  <Pause length="1"/>
  <Connect>
    <Stream url="${wsUrl}/api/twilio/media-stream">
      <Parameter name="conversationId" value="${conversation.id}"/>
      <Parameter name="agentId" value="${agentId}"/>
      <Parameter name="orgId" value="${orgId}"/>
      <Parameter name="callerPhone" value="${to}"/>
      <Parameter name="voice" value="${config.voice}"/>
      <Parameter name="language" value="${config.language}"/>
      <Parameter name="direction" value="outbound"/>
    </Stream>
  </Connect>
</Response>`;

    return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
  } catch (error) {
    console.error("Outbound webhook error:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We encountered an error. Goodbye.</Say>
  <Hangup/>
</Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
