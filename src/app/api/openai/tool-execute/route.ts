import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  conversations,
  organizations,
  phoneNumbers,
  agents,
  calendarIntegrations,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { searchKnowledge } from "@/lib/knowledge/knowledge-service";
import { getSubAccountClient } from "@/lib/twilio";
import { logAuditEvent } from "@/lib/compliance/audit";

/**
 * OpenAI tool execution endpoint — called by OpenAI during a SIP Realtime session
 * when the agent invokes a function tool.
 * 
 * OpenAI POSTs tool call details → we execute → return result.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { call_id, tool_name, arguments: toolArgs } = body;

    if (!tool_name) {
      return NextResponse.json({ error: "Missing tool_name" }, { status: 400 });
    }

    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.metadata, { sipCallId: call_id } as any),
    });

    const agentId = conv?.agentId;

    let result: unknown;

    switch (tool_name) {
      case "lookup_knowledge": {
        const query = toolArgs?.query || "general information";
        if (!agentId) {
          result = { answer: "I don't have access to the knowledge base right now." };
          break;
        }
        const chunks = await searchKnowledge(agentId, query);
        result = chunks.length > 0
          ? { answer: chunks.join("\n\n") }
          : { answer: "I don't have specific information about that topic." };
        break;
      }

      case "transfer_call": {
        const reason = toolArgs?.reason || "Customer requested transfer";
        if (conv) {
          const agent = await db.query.agents.findFirst({
            where: eq(agents.id, conv.agentId),
          });

          if (agent?.transferPhone) {
            result = {
              action: "transfer",
              transferTo: agent.transferPhone,
              message: `Transferring you to a team member now. ${reason}`,
            };
          } else {
            result = {
              action: "no_transfer",
              message: "I'm sorry, I don't have a transfer number configured. Is there anything else I can help with?",
            };
          }
        } else {
          result = { action: "no_transfer", message: "Transfer not available." };
        }
        break;
      }

      case "share_booking_link": {
        result = await handleShareBookingLink(conv, toolArgs?.note);
        break;
      }

      default:
        result = { error: `Unknown tool: ${tool_name}` };
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Tool execution error:", error);
    return NextResponse.json(
      { result: { error: "Tool execution failed" } },
      { status: 500 }
    );
  }
}

type ConversationRow = NonNullable<
  Awaited<ReturnType<typeof db.query.conversations.findFirst>>
>;

/**
 * Realtime tool: text the caller a Calendly booking link.
 *
 * Looks up the conversation -> org's active Calendly integration ->
 * org's active SmartLine number, and sends an SMS via the org's Twilio
 * sub-account. Falls back gracefully if anything is missing so the agent
 * can still say something useful to the caller.
 */
async function handleShareBookingLink(
  conv: ConversationRow | undefined,
  note?: string
): Promise<unknown> {
  if (!conv) {
    return { ok: false, message: "Booking is not available right now." };
  }
  if (!conv.callerPhone) {
    return {
      ok: false,
      message:
        "I don't have your number from this call. Could you read it out so I can text you the link?",
    };
  }

  const integration = await db.query.calendarIntegrations.findFirst({
    where: and(
      eq(calendarIntegrations.orgId, conv.orgId),
      eq(calendarIntegrations.provider, "calendly"),
      eq(calendarIntegrations.status, "active")
    ),
  });

  if (!integration?.calendlySchedulingUrl) {
    logAuditEvent(
      conv.orgId,
      "agent.share_booking_link.missing",
      "conversation",
      conv.id
    ).catch(() => {});
    return {
      ok: false,
      message: "I'll have someone follow up to schedule with you.",
    };
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, conv.orgId),
  });
  if (!org?.twilioSubAccountSid || !org?.twilioSubAuthToken) {
    return { ok: false, message: "I'll have someone follow up to schedule with you." };
  }

  // Pick any active SmartLine number for this org as the From.
  const fromNumber = await db.query.phoneNumbers.findFirst({
    where: and(
      eq(phoneNumbers.orgId, conv.orgId),
      eq(phoneNumbers.status, "active")
    ),
  });
  if (!fromNumber?.phoneNumber) {
    return { ok: false, message: "I'll have someone follow up to schedule with you." };
  }

  const trimmedNote = (note || "").toString().trim().slice(0, 140);
  const body = trimmedNote
    ? `Here's a link to book a time (${trimmedNote}): ${integration.calendlySchedulingUrl}`
    : `Here's a link to book a time that works for you: ${integration.calendlySchedulingUrl}`;

  try {
    const client = getSubAccountClient(org.twilioSubAccountSid, org.twilioSubAuthToken);
    await client.messages.create({
      to: conv.callerPhone,
      from: fromNumber.phoneNumber,
      body,
    });

    logAuditEvent(
      conv.orgId,
      "agent.share_booking_link.sent",
      "conversation",
      conv.id,
      undefined,
      undefined,
      { to: conv.callerPhone }
    ).catch(() => {});

    return {
      ok: true,
      message:
        "I just texted you a link to pick a time. Anything else I can help with?",
    };
  } catch (err) {
    console.error("[share_booking_link] SMS failed:", err);
    return { ok: false, message: "I'll have someone follow up to schedule with you." };
  }
}
