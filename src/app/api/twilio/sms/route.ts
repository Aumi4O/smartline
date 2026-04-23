import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneNumbers, agents, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildCallConfig, createCallRecord, addCallMessage } from "@/lib/calls/call-handler";
import { deductCredits } from "@/lib/billing/credits";
import { USAGE_RATES } from "@/lib/pricing";

/**
 * Twilio SMS/WhatsApp webhook — called when someone texts a SmartLine number.
 * Uses gpt-5-mini for text responses (cheaper than voice).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = (formData.get("From") as string) || "";
    const to = (formData.get("To") as string) || "";
    const body = (formData.get("Body") as string) || "";
    const messageSid = (formData.get("MessageSid") as string) || "";

    const cleanTo = to.replace(/[^\d+]/g, "").replace("whatsapp:", "");

    const phoneRecord = await db.query.phoneNumbers.findFirst({
      where: eq(phoneNumbers.phoneNumber, cleanTo),
    });

    if (!phoneRecord || phoneRecord.status !== "active") {
      return smsResponse("This number is not currently active.");
    }

    const agent = phoneRecord.agentId
      ? await db.query.agents.findFirst({
          where: and(eq(agents.id, phoneRecord.agentId), eq(agents.isActive, true)),
        })
      : await db.query.agents.findFirst({
          where: and(eq(agents.orgId, phoneRecord.orgId), eq(agents.isActive, true)),
        });

    if (!agent) {
      return smsResponse("No agent is available at this number right now.");
    }

    const config = await buildCallConfig(phoneRecord.orgId, agent.id, from);

    const channel = from.startsWith("whatsapp:") ? "sms" : "sms";

    const conversation = await createCallRecord(
      phoneRecord.orgId,
      agent.id,
      channel,
      from.replace("whatsapp:", ""),
      { messageSid, direction: "inbound" }
    );

    await addCallMessage(conversation.id, "user", body);

    const apiKey = process.env.OPENAI_API_KEY!;
    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: config.systemPrompt },
          { role: "user", content: body },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    let reply = "I'm sorry, I'm having trouble right now. Please try again later.";
    if (chatResponse.ok) {
      const data = await chatResponse.json();
      reply = data.choices?.[0]?.message?.content || reply;
    }

    await addCallMessage(conversation.id, "assistant", reply);

    const costCents = Math.ceil(USAGE_RATES.sms_per_segment_cents * Math.ceil(reply.length / 160));
    await deductCredits(
      phoneRecord.orgId,
      costCents,
      `SMS response — ${Math.ceil(reply.length / 160)} segments`,
      "usage",
      { conversationId: conversation.id }
    );

    return smsResponse(reply);
  } catch (error) {
    console.error("SMS webhook error:", error);
    return smsResponse("Something went wrong. Please try again.");
  }
}

function smsResponse(message: string): NextResponse {
  const clean = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${clean}</Message>
</Response>`;

  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}
