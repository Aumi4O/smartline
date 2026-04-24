import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneNumbers, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAgentForCall, createCallRecord } from "@/lib/calls/call-handler";
import { getRecordingDisclosure, grantConsent } from "@/lib/compliance/consent";
import { logAuditEvent } from "@/lib/compliance/audit";
import { provisionOrg } from "@/lib/provisioning/orchestrator";
import { buildSipUri, escapeXml } from "@/lib/sip";

/**
 * Twilio voice webhook — called when someone dials a SmartLine number.
 *
 * Architecture: we hand the call straight to OpenAI's SIP Connector via
 * TwiML `<Dial><Sip>sip:{openaiProjectId}@sip.openai.com;transport=tls</Sip></Dial>`.
 * OpenAI then fires `realtime.call.incoming` to /api/openai/sip-webhook which
 * accepts the call and configures the agent. No WebSocket bridge needed, which
 * is important because Vercel serverless cannot host long-lived WS connections.
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

    let org = await db.query.organizations.findFirst({
      where: eq(organizations.id, phoneRecord.orgId),
    });

    // Per-tenant OpenAI project is nice for isolation, but not required for a
    // working call. Fall back to a shared platform project if the tenant
    // hasn't been provisioned yet (or if OPENAI_ADMIN_KEY isn't available).
    if (!org?.openaiProjectId) {
      try {
        await provisionOrg(phoneRecord.orgId);
        org = await db.query.organizations.findFirst({
          where: eq(organizations.id, phoneRecord.orgId),
        });
      } catch (err) {
        console.error(
          `[twilio/voice] OpenAI auto-provision failed for ${phoneRecord.orgId}:`,
          err
        );
      }
    }

    const projectId =
      org?.openaiProjectId || process.env.OPENAI_SIP_PROJECT_ID || null;

    if (!projectId) {
      return new NextResponse(
        twiml(
          "This agent is still being set up. Please try again in a minute. Goodbye.",
          true
        ),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const conversation = await createCallRecord(
      phoneRecord.orgId,
      agent.id,
      "phone",
      from,
      { callSid, calledNumber: cleanNumber, direction: "inbound" }
    );

    grantConsent(phoneRecord.orgId, from, "recording", "call_disclosure").catch(() => {});
    logAuditEvent(phoneRecord.orgId, "call.inbound", "conversation", conversation.id, undefined, undefined, { from, callSid }).catch(() => {});

    const sipUri = buildSipUri(projectId, {
      "X-SmartLine-OrgId": phoneRecord.orgId,
      "X-SmartLine-AgentId": agent.id,
      "X-SmartLine-ConversationId": conversation.id,
      "X-SmartLine-Direction": "inbound",
    });

    const disclosure = getRecordingDisclosure();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`;
    const fallbackAction = `${appUrl}/api/twilio/voice/fallback?conversationId=${encodeURIComponent(
      conversation.id
    )}`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${disclosure}</Say>
  <Pause length="1"/>
  <Dial answerOnBridge="true" timeout="30" action="${escapeXml(fallbackAction)}" method="POST">
    <Sip>${escapeXml(sipUri)}</Sip>
  </Dial>
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

