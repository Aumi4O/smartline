import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, campaigns, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createCallRecord } from "@/lib/calls/call-handler";
import { getRecordingDisclosure } from "@/lib/compliance/consent";
import {
  shouldPlayDisclosure,
  recordDisclosureConsent,
} from "@/lib/compliance/disclosure-settings";
import { provisionOrg } from "@/lib/provisioning/orchestrator";
import { buildSipUri, escapeXml } from "@/lib/sip";

/**
 * Twilio outbound call webhook — called when an outbound call connects.
 * Returns TwiML to bridge the call to OpenAI SIP Connector via `<Dial><Sip>`.
 *
 * Handles AMD (Answering Machine Detection):
 * - Human answered  → bridge to OpenAI SIP
 * - Voicemail       → play message or hang up per campaign config
 *
 * Lead/campaign context is passed to the SIP webhook via custom X-SmartLine-*
 * SIP headers on the Sip URI (Twilio forwards them, OpenAI echoes them in the
 * `realtime.call.incoming` payload under `call.headers`).
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

    const isVoicemail =
      answeredBy === "machine_start" ||
      answeredBy === "machine_end_beep" ||
      answeredBy === "machine_end_silence";

    if (isVoicemail) {
      const action = campaign?.voicemailAction || "leave_message";

      if (action === "hang_up") {
        if (lead) {
          await db
            .update(leads)
            .set({ status: "voicemail", outcome: "voicemail", updatedAt: new Date() })
            .where(eq(leads.id, lead.id));
        }
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
          { headers: { "Content-Type": "text/xml" } }
        );
      }

      const vmMessage =
        campaign?.voicemailMessage ||
        `Hi${lead?.firstName ? ` ${lead.firstName}` : ""}, this is a call from SmartLine. We'll try you again later, or you can call us back at your convenience. Thank you!`;

      if (lead) {
        await db
          .update(leads)
          .set({ status: "voicemail", outcome: "voicemail", updatedAt: new Date() })
          .where(eq(leads.id, lead.id));
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

    let org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org?.openaiProjectId) {
      try {
        await provisionOrg(orgId);
        org = await db.query.organizations.findFirst({
          where: eq(organizations.id, orgId),
        });
      } catch (err) {
        console.error(`[twilio/outbound] OpenAI auto-provision failed for ${orgId}:`, err);
      }
    }

    const projectId =
      org?.openaiProjectId || process.env.OPENAI_SIP_PROJECT_ID || null;

    if (!projectId) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This agent is still being set up. Goodbye.</Say>
  <Hangup/>
</Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const conversation = await createCallRecord(orgId, agentId, "phone", to, {
      callSid,
      direction: "outbound",
      campaignId,
      leadId,
    });

    if (lead) {
      await db
        .update(leads)
        .set({ lastConversationId: conversation.id, updatedAt: new Date() })
        .where(eq(leads.id, lead.id));
    }

    const sipUri = buildSipUri(projectId, {
      "X-SmartLine-OrgId": orgId,
      "X-SmartLine-AgentId": agentId,
      "X-SmartLine-ConversationId": conversation.id,
      "X-SmartLine-Direction": "outbound",
      ...(leadId ? { "X-SmartLine-LeadId": leadId } : {}),
      ...(campaignId ? { "X-SmartLine-CampaignId": campaignId } : {}),
    });

    const playDisclosure = await shouldPlayDisclosure(orgId, to);
    if (playDisclosure) {
      recordDisclosureConsent(orgId, to, "outbound_disclosure").catch(() => {});
    }

    const disclosureSay = playDisclosure
      ? `  <Say voice="Polly.Joanna">${getRecordingDisclosure()}</Say>\n  <Pause length="1"/>\n`
      : "";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${disclosureSay}  <Dial answerOnBridge="true" timeout="30">
    <Sip>${escapeXml(sipUri)}</Sip>
  </Dial>
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

