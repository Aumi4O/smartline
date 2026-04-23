import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, agents, phoneNumbers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildCallConfig, createCallRecord } from "@/lib/calls/call-handler";

/**
 * OpenAI SIP Connector webhook — receives `realtime.call.incoming` events.
 * 
 * When a Twilio SIP trunk routes a call to sip.openai.com, OpenAI sends
 * this webhook so we can decide whether to accept and configure the session.
 * 
 * Flow:
 * 1. Twilio routes inbound call → Elastic SIP Trunk → sip.openai.com
 * 2. OpenAI receives the SIP INVITE and fires this webhook  
 * 3. We look up the org by their OpenAI project ID
 * 4. We accept the call via POST /v1/realtime/calls/{call_id}/accept
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type;

    if (eventType !== "realtime.call.incoming") {
      return NextResponse.json({ ok: true });
    }

    const callId = body.call?.id;
    const projectId = body.call?.project_id;
    const sipFrom = body.call?.headers?.from || body.call?.from;
    const sipTo = body.call?.headers?.to || body.call?.to;

    if (!callId || !projectId) {
      console.error("SIP webhook: missing call_id or project_id");
      return NextResponse.json({ error: "Missing call info" }, { status: 400 });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.openaiProjectId, projectId),
    });

    if (!org) {
      console.error(`SIP webhook: unknown project ${projectId}`);
      return NextResponse.json({ error: "Unknown project" }, { status: 404 });
    }

    const calledNumber = extractPhoneFromSipUri(sipTo);
    const callerPhone = extractPhoneFromSipUri(sipFrom);

    let agent = null;
    if (calledNumber) {
      const pn = await db.query.phoneNumbers.findFirst({
        where: and(
          eq(phoneNumbers.orgId, org.id),
          eq(phoneNumbers.phoneNumber, calledNumber)
        ),
      });
      if (pn?.agentId) {
        agent = await db.query.agents.findFirst({
          where: and(eq(agents.id, pn.agentId), eq(agents.isActive, true)),
        });
      }
    }

    if (!agent) {
      agent = await db.query.agents.findFirst({
        where: and(eq(agents.orgId, org.id), eq(agents.isActive, true)),
      });
    }

    if (!agent) {
      console.error(`SIP webhook: no active agent for org ${org.id}`);
      return NextResponse.json({ error: "No agent configured" }, { status: 404 });
    }

    const config = await buildCallConfig(org.id, agent.id, callerPhone);

    const conversation = await createCallRecord(
      org.id,
      agent.id,
      "phone",
      callerPhone,
      { sipCallId: callId, calledNumber, projectId }
    );

    const apiKey = org.openaiApiKeyEncrypted || process.env.OPENAI_API_KEY!;

    const acceptPayload = {
      model: "gpt-4o-realtime-preview",
      voice: config.voice,
      instructions: config.systemPrompt,
      tools: config.tools,
      input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 200,
      },
    };

    const acceptRes = await fetch(
      `https://api.openai.com/v1/realtime/calls/${callId}/accept`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(acceptPayload),
      }
    );

    if (!acceptRes.ok) {
      const errText = await acceptRes.text();
      console.error(`SIP accept failed: ${acceptRes.status} - ${errText}`);
      return NextResponse.json(
        { error: "Failed to accept call" },
        { status: 500 }
      );
    }

    console.log(`SIP call accepted: ${callId} → agent "${agent.name}" (org: ${org.slug})`);

    return NextResponse.json({
      accepted: true,
      callId,
      conversationId: conversation.id,
      agentName: agent.name,
    });
  } catch (error) {
    console.error("SIP webhook error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

function extractPhoneFromSipUri(uri: string | undefined): string {
  if (!uri) return "";
  const match = uri.match(/sip:(\+?\d+)@/);
  return match ? match[1] : uri.replace(/[^\d+]/g, "");
}
