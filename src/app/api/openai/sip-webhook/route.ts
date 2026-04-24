import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, agents, phoneNumbers, conversations, leads, campaigns } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { buildCallConfig, createCallRecord } from "@/lib/calls/call-handler";
import { readSipHeader } from "@/lib/sip";
import { toE164BestEffort } from "@/lib/phone/e164";
import crypto from "node:crypto";

/** Cold webhook + accept() can need extra time on Vercel; avoid timing out the INVITE. */
export const maxDuration = 60;

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

    // #region DBG054c86 sip-webhook-entry
    try {
      const __dbg = {
        sessionId: "054c86",
        runId: "initial",
        hypothesisId: "H2,H3",
        location: "src/app/api/openai/sip-webhook/route.ts:POST-entry",
        message: "openai webhook reached",
        data: {
          contentType: req.headers.get("content-type") || "",
          hasSig: !!req.headers.get("webhook-signature"),
          hasId: !!req.headers.get("webhook-id"),
          hasTs: !!req.headers.get("webhook-timestamp"),
          bodyLen: rawBody.length,
          hasWebhookSecretEnv: !!process.env.OPENAI_WEBHOOK_SECRET,
        },
        timestamp: Date.now(),
      };
      console.log(`[DBG054c86] sip-webhook.enter ${JSON.stringify(__dbg.data)}`);
      fetch(
        "http://127.0.0.1:7245/ingest/74910cf5-e5e4-4115-b915-2f0a3acaea88",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "054c86",
          },
          body: JSON.stringify(__dbg),
        }
      ).catch(() => {});
    } catch {}
    // #endregion

    if (!verifyOpenAISignature(req, rawBody)) {
      // #region DBG054c86 sip-webhook-sig-fail
      console.log(`[DBG054c86] sip-webhook.sig-fail`);
      // #endregion
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

    // Trace every incoming INVITE so we can see the exact header shape OpenAI
    // is sending. Keeps diagnosis fast when a call doesn't connect.
    try {
      console.log(
        `[sip-webhook] incoming call=${callId} project=${projectId} from=${sipFrom || ""} to=${sipTo || ""} headerKeys=${
          sipHeaders ? Object.keys(sipHeaders).join(",") : ""
        }`
      );
    } catch {}

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

    const calledNumber = extractPhoneFromSipUri(sipTo);
    const callerPhone = extractPhoneFromSipUri(sipFrom);

    // Org resolution — try in order:
    //   1. X-SmartLine-OrgId SIP header (set by our own <Dial><Sip> TwiML)
    //   2. organizations.openaiProjectId == project_id (per-tenant OpenAI project)
    //   3. phoneNumbers.phoneNumber == calledNumber (shared fallback project)
    //
    // #3 is critical: when OPENAI_SIP_PROJECT_ID is a shared platform project,
    // the `project_id` in the webhook matches *every* tenant, so we can't use
    // it to identify one. The dialled number is our reliable tenant key.
    let org = hintedOrgId
      ? await db.query.organizations.findFirst({
          where: eq(organizations.id, hintedOrgId),
        })
      : null;

    if (!org) {
      org = await db.query.organizations.findFirst({
        where: eq(organizations.openaiProjectId, projectId),
      });
    }

    if (!org && calledNumber) {
      const uniqueNumbers = [calledNumber, toE164BestEffort(calledNumber)].filter(
        (n, i, a) => n && a.indexOf(n) === i
      ) as string[];
      const pn = await db.query.phoneNumbers.findFirst({
        where: inArray(phoneNumbers.phoneNumber, uniqueNumbers),
      });
      if (pn) {
        org = await db.query.organizations.findFirst({
          where: eq(organizations.id, pn.orgId),
        });
      }
    }

    // OpenAI often puts the project id in the SIP "To" user-part, not the
    // Twilio E.164 — so `calledNumber` is empty. We still have
    // X-SmartLine-* in most cases, but this fallback fixes the case where
    // only the conversation id round-trips reliably.
    if (!org && hintedConversationId) {
      const convo = await db.query.conversations.findFirst({
        where: eq(conversations.id, hintedConversationId),
      });
      if (convo) {
        org = await db.query.organizations.findFirst({
          where: eq(organizations.id, convo.orgId),
        });
      }
    }

    if (!org) {
      console.error(
        `[sip-webhook] org not found — project=${projectId} hintedOrg=${hintedOrgId} calledNumber=${calledNumber} callerPhone=${callerPhone} conversationHint=${hintedConversationId || ""}`
      );
      return NextResponse.json({ error: "Unknown org" }, { status: 404 });
    }

    console.log(
      `[sip-webhook] org=${org.id} project=${projectId} called=${calledNumber} from=${callerPhone} hintedAgent=${hintedAgentId}`
    );

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
      const nums = [calledNumber, toE164BestEffort(calledNumber)].filter(
        (n, i, a) => n && a.indexOf(n) === i
      ) as string[];
      const pn = await db.query.phoneNumbers.findFirst({
        where: and(eq(phoneNumbers.orgId, org.id), inArray(phoneNumbers.phoneNumber, nums)),
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

    // Per-tenant keys (org.openaiApiKeyEncrypted) are populated by the
    // provisioning flow. They're stored *as the raw key* today — the
    // "encrypted" column name predates KMS. If it looks like a real API key
    // (sk-...) we use it. Otherwise fall back to the platform key so the
    // agent can still answer.
    const perTenantKey = org.openaiApiKeyEncrypted;
    const apiKey =
      perTenantKey && perTenantKey.startsWith("sk-")
        ? perTenantKey
        : process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error(`[sip-webhook] no OpenAI API key available for org ${org.id}`);
      return NextResponse.json({ error: "No API key" }, { status: 500 });
    }

    // Minimum-safe accept payload. We intentionally omit:
    //  - tools (malformed function schemas silently kill the call)
    //  - input_audio_transcription (model name varies by account)
    //  - turn_detection (defaults are fine)
    // Once the call is proven to connect, we can re-enable these.
    const voice = pickRealtimeVoice(config.voice);
    const acceptPayload: Record<string, unknown> = {
      type: "realtime",
      model: "gpt-realtime",
      instructions: systemPrompt,
      voice,
    };

    const acceptRes = await fetch(
      `https://api.openai.com/v1/realtime/calls/${callId}/accept`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1",
        },
        body: JSON.stringify(acceptPayload),
      }
    );

    if (!acceptRes.ok) {
      const errText = await acceptRes.text().catch(() => "");
      const requestId = acceptRes.headers.get("x-request-id") || "";
      console.error(
        `[sip-webhook] accept failed: HTTP ${acceptRes.status} req=${requestId} body=${errText}`
      );
      // #region DBG054c86 sip-webhook-accept-fail
      try {
        const __dbg = {
          sessionId: "054c86",
          runId: "initial",
          hypothesisId: "H4",
          location: "src/app/api/openai/sip-webhook/route.ts:accept-fail",
          message: "openai accept rejected",
          data: {
            httpStatus: acceptRes.status,
            requestId,
            bodySnippet: errText.slice(0, 400),
            voice,
            orgId: org.id,
            agentId: agent.id,
            apiKeySource:
              perTenantKey && perTenantKey.startsWith("sk-") ? "per-tenant" : "platform",
          },
          timestamp: Date.now(),
        };
        console.log(`[DBG054c86] sip-webhook.accept-fail ${JSON.stringify(__dbg.data)}`);
        fetch(
          "http://127.0.0.1:7245/ingest/74910cf5-e5e4-4115-b915-2f0a3acaea88",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "054c86",
            },
            body: JSON.stringify(__dbg),
          }
        ).catch(() => {});
      } catch {}
      // #endregion
      return NextResponse.json(
        { error: "Failed to accept call", status: acceptRes.status, detail: errText },
        { status: 500 }
      );
    }

    console.log(
      `[sip-webhook] accepted ${callId} → agent "${agent.name}" voice=${voice} org=${org.slug} dir=${hintedDirection}`
    );

    // #region DBG054c86 sip-webhook-accept-ok
    try {
      const __dbg = {
        sessionId: "054c86",
        runId: "initial",
        hypothesisId: "H2,H3,H4",
        location: "src/app/api/openai/sip-webhook/route.ts:accept-ok",
        message: "openai accept succeeded",
        data: {
          callId,
          orgId: org.id,
          agentId: agent.id,
          voice,
          projectId,
          direction: hintedDirection,
        },
        timestamp: Date.now(),
      };
      console.log(`[DBG054c86] sip-webhook.accept-ok ${JSON.stringify(__dbg.data)}`);
      fetch(
        "http://127.0.0.1:7245/ingest/74910cf5-e5e4-4115-b915-2f0a3acaea88",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "054c86",
          },
          body: JSON.stringify(__dbg),
        }
      ).catch(() => {});
    } catch {}
    // #endregion

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
  const s = String(uri);
  const m = s.match(/sip:([^@;?]+)@/i);
  if (m) {
    const user = m[1].trim();
    if (/^\+?[\d]+$/.test(user)) {
      return toE164BestEffort(user);
    }
    return "";
  }
  return toE164BestEffort(s);
}

const REALTIME_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "marin",
  "cedar",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
]);

function pickRealtimeVoice(v: string | undefined | null): string {
  if (v && REALTIME_VOICES.has(v)) return v;
  return "shimmer";
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
