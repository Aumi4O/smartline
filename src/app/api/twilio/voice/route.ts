import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneNumbers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAgentForCall, buildCallConfig, createCallRecord } from "@/lib/calls/call-handler";
import { getRecordingDisclosure, grantConsent } from "@/lib/compliance/consent";
import { logAuditEvent } from "@/lib/compliance/audit";

/**
 * Twilio voice webhook — called when someone dials a SmartLine number.
 * 
 * Flow:
 * 1. Twilio calls this webhook with the dialed number + caller info
 * 2. We look up which org/agent owns this number
 * 3. We return TwiML that connects to OpenAI Realtime via Media Streams
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const called = formData.get("Called") as string || formData.get("To") as string || "";
    const from = formData.get("From") as string || "";
    const callSid = formData.get("CallSid") as string || "";

    const cleanNumber = called.replace(/[^\d+]/g, "");

    const phoneRecord = await db.query.phoneNumbers.findFirst({
      where: eq(phoneNumbers.phoneNumber, cleanNumber),
    });

    if (!phoneRecord || phoneRecord.status !== "active") {
      return new NextResponse(
        twiml("We're sorry, this number is not currently active. Goodbye.", true),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const agent = phoneRecord.agentId
      ? await getAgentForCall(phoneRecord.orgId, phoneRecord.agentId)
      : await getAgentForCall(phoneRecord.orgId);

    if (!agent) {
      return new NextResponse(
        twiml("No agent is configured for this number. Please contact the business directly. Goodbye.", true),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const config = await buildCallConfig(phoneRecord.orgId, agent.id, from);

    const conversation = await createCallRecord(
      phoneRecord.orgId,
      agent.id,
      "phone",
      from,
      { callSid, calledNumber: cleanNumber }
    );

    grantConsent(phoneRecord.orgId, from, "recording", "call_disclosure").catch(() => {});
    logAuditEvent(phoneRecord.orgId, "call.inbound", "conversation", conversation.id, undefined, undefined, { from, callSid }).catch(() => {});

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
      <Parameter name="agentId" value="${agent.id}"/>
      <Parameter name="orgId" value="${phoneRecord.orgId}"/>
      <Parameter name="callerPhone" value="${from}"/>
      <Parameter name="voice" value="${config.voice}"/>
      <Parameter name="language" value="${config.language}"/>
    </Stream>
  </Connect>
</Response>`;

    return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
  } catch (error) {
    console.error("Twilio voice webhook error:", error);
    return new NextResponse(
      twiml("We're experiencing technical difficulties. Please try again later. Goodbye.", true),
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}

function twiml(message: string, hangup = false): string {
  const clean = message
    .replace(/&/g, " and ")
    .replace(/</g, "")
    .replace(/>/g, "");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${clean}</Say>
  ${hangup ? "<Hangup/>" : ""}
</Response>`;
}
