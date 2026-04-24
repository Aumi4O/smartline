import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, agents, phoneNumbers, conversations, leads, campaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildCallConfig, createCallRecord } from "@/lib/calls/call-handler";
import { readSipHeader } from "@/lib/sip";
import crypto from "node:crypto";

/**
 * OpenAI SIP Connector webhook — receives `realtime.call.incoming` events.
 *
 * Flow:
 * 1. Twilio routes a PSTN call to `sip.openai.com` via TwiML `<Dial><Sip>`.
 * 2. OpenAI receives the SIP INVITE and fires this webhook.
 * 3. We resolve org (via `project_id`) and agent (via X-SmartLine-* headers or the dialled number).
 * 4. We POST `/v1/realtime/calls/{call_id}/accept` with the agent config.
 *
 * SIP headers (optional, set by our own TwiML):
 *   X-SmartLine-OrgId, X-SmartLine-AgentId, X-SmartLine-ConversationId,
 *   X-SmartLine-Direction (inbound|outbound), X-SmartLine-LeadId, X-SmartLine-CampaignId
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyOpenAISignature(req, rawBody)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventType = body.type;

    if (eventType !== "realtime.call.incoming") {
      return NextResponse.json({ ok: true });
    }

    const callId = body.call?.id;
    const projectId = body.call?.project_id;
    const sipHeaders = body.call?.headers as Record<string, string | string[]> | undefined;
    const sipFrom = readSipHeader(sipHeaders, "from") || body.call?.from;
    const sipTo = readSipHeader(sipHeaders, "to") || body.call?.to;

    if (!callId || !projectId) {
      console.error("[sip-webhook] missing call_id or project_id");
      return NextResponse.json({ error: "Missing call info" }, { status: 400 });
    }

    const hintedOrgId = readSipHeader(sipHeaders, "X-SmartLine-OrgId");
    const hintedAgentId = readSipHeader(sipHeaders, "X-SmartLine-AgentId");
    const hintedConversationId = readSipHeader(sipHeaders, "X-SmartLine-ConversationId");
    const hintedDirection = (readSipHeader(sipHeaders, "X-SmartLine-Direction") || "inbound").toLowerCase();
    const hintedLeadId = readSipHeader(sipHeaders, "X-SmartLine-LeadId");
    const hintedCampaignId = readSipHeader(sipHeaders, "X-SmartLine-CampaignId");

    let org = hintedOrgId
      ? await db.query.organizations.findFirst({ where: eq(organizations.id, hintedOrgId) })
      : null;
    if (!org) {
      org = await db.query.organizations.findFirst({
        where: eq(organizations.openaiProjectId, projectId),
      });
    }

    if (!org) {
      console.error(`[sip-webhook] unknown project ${projectId}`);
      return NextResponse.json({ error: "Unknown project" }, { status: 404 });
    }

    const calledNumber = extractPhoneFromSipUri(sipTo);
    const callerPhone = extractPhoneFromSipUri(sipFrom);

    let agent = hintedAgentId
      ? await db.query.agents.findFirst({
          where: and(
            eq(agents.id, hintedAgentId),
            eq(agents.orgId, org.id),
            eq(agents.isActive, true)
          ),
        })
      : null;

    if (!agent && calledNumber) {
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
      console.error(`[sip-webhook] no active agent for org ${org.id}`);
      return NextResponse.json({ error: "No agent configured" }, { status: 404 });
    }

    const config = await buildCallConfig(org.id, agent.id, callerPhone);

    let outboundContext = "";
    if (hintedDirection === "outbound") {
      const lead = hintedLeadId
        ? await db.query.leads.findFirst({ where: eq(leads.id, hintedLeadId) })
        : null;
      const campaign = hintedCampaignId
        ? await db.query.campaigns.findFirst({ where: eq(campaigns.id, hintedCampaignId) })
        : null;

      const parts: string[] = [];
      if (lead) {
        if (lead.firstName || lead.lastName) {
          parts.push(`You are calling ${[lead.firstName, lead.lastName].filter(Boolean).join(" ")}.`);
        }
        if (lead.company) parts.push(`They work at ${lead.company}.`);
        if (lead.notes) parts.push(`Context: ${lead.notes}`);
      }
      if (campaign?.outboundPrompt) {
        parts.unshift(campaign.outboundPrompt);
      }
      outboundContext = parts.join("\n");
    }

    const systemPrompt = outboundContext
      ? `${config.systemPrompt}\n\nOUTBOUND CALL CONTEXT:\n${outboundContext}`
      : config.systemPrompt;

    let conversationId = hintedConversationId;
    if (conversationId) {
      const existing = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });
      if (!existing) conversationId = undefined;
    }
    if (!conversationId) {
      const created = await createCallRecord(
        org.id,
        agent.id,
        "phone",
        callerPhone,
        {
          sipCallId: callId,
          calledNumber,
          projectId,
          direction: hintedDirection,
          leadId: hintedLeadId,
          campaignId: hintedCampaignId,
        }
      );
      conversationId = created.id;
    }

    const apiKey = org.openaiApiKeyEncrypted || process.env.OPENAI_API_KEY!;

    const acceptPayload = {
      type: "realtime",
      model: "gpt-realtime",
      instructions: systemPrompt,
      voice: config.voice,
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
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(acceptPayload),
      }
    );

    if (!acceptRes.ok) {
      const errText = await acceptRes.text();
      console.error(`[sip-webhook] accept failed: ${acceptRes.status} - ${errText}`);
      return NextResponse.json(
        { error: "Failed to accept call" },
        { status: 500 }
      );
    }

    console.log(
      `[sip-webhook] accepted ${callId} → agent "${agent.name}" (org: ${org.slug}, dir: ${hintedDirection})`
    );

    return NextResponse.json({
      accepted: true,
      callId,
      conversationId,
      agentName: agent.name,
    });
  } catch (error) {
    console.error("[sip-webhook] error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function extractPhoneFromSipUri(uri: string | undefined | null): string {
  if (!uri) return "";
  const match = uri.match(/sip:(\+?\d+)@/);
  return match ? match[1] : String(uri).replace(/[^\d+]/g, "");
}

/**
 * Verifies OpenAI webhook signature using the Standard Webhooks scheme.
 *
 * Headers:
 *   webhook-id:        unique id of the webhook delivery
 *   webhook-timestamp: unix timestamp (seconds)
 *   webhook-signature: one or more `v1,<base64>` values (space-separated)
 *
 * Signature content: `${id}.${timestamp}.${body}`
 * Secret: `whsec_<base64>` — we base64-decode the bytes after the prefix.
 *
 * If OPENAI_WEBHOOK_SECRET is not configured, we allow the request through
 * (dev / bootstrap). Set it in production.
 */
function verifyOpenAISignature(req: NextRequest, body: string): boolean {
  const secret = process.env.OPENAI_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[sip-webhook] OPENAI_WEBHOOK_SECRET not set — accepting without verification");
    return true;
  }

  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signatureHeader = req.headers.get("webhook-signature");

  if (!id || !timestamp || !signatureHeader) {
    console.error("[sip-webhook] missing webhook headers");
    return false;
  }

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > 60 * 5) {
    console.error("[sip-webhook] stale webhook timestamp");
    return false;
  }

  const keyBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const signedContent = `${id}.${timestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", keyBytes)
    .update(signedContent)
    .digest("base64");

  const provided = signatureHeader
    .split(" ")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("v1,"))
    .map((p) => p.slice(3));

  for (const sig of provided) {
    if (sig.length !== expected.length) continue;
    try {
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return true;
      }
    } catch {
      // mismatched length handled above
    }
  }

  console.error("[sip-webhook] signature mismatch");
  return false;
}
