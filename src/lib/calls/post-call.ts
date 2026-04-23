import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deductCredits } from "@/lib/billing/credits";
import { USAGE_RATES } from "@/lib/pricing";
import { fireWebhook } from "@/lib/webhooks/subscriber-webhook";

export async function processCallEnd(
  conversationId: string,
  orgId: string,
  durationSec: number,
  transcript: { role: string; content: string }[]
) {
  const voiceCostCents = Math.ceil((durationSec / 60) * USAGE_RATES.voice_per_min_cents);
  const twilioCostCents = Math.ceil((durationSec / 60) * USAGE_RATES.twilio_inbound_per_min_cents);
  const totalCostCents = voiceCostCents + twilioCostCents;

  await deductCredits(
    orgId,
    totalCostCents,
    `Phone call — ${Math.ceil(durationSec / 60)} min`,
    "usage",
    { conversationId, durationSec, voiceCostCents, twilioCostCents }
  );

  let summary = "";
  try {
    summary = generateQuickSummary(transcript);
  } catch {
    summary = `${Math.ceil(durationSec / 60)} minute call`;
  }

  await db
    .update(conversations)
    .set({
      status: "completed",
      summary,
      durationSec,
      costCents: totalCostCents,
      endedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));

  fireWebhook(orgId, "call.completed", {
    conversationId,
    durationSec,
    costCents: totalCostCents,
    summary,
  }).catch(() => {});

  return { totalCostCents, summary };
}

function generateQuickSummary(transcript: { role: string; content: string }[]): string {
  const userMessages = transcript.filter((m) => m.role === "user").map((m) => m.content);
  const assistantMessages = transcript.filter((m) => m.role === "assistant").map((m) => m.content);

  if (userMessages.length === 0) return "No conversation recorded";

  const topics = userMessages.slice(0, 3).join(" ").slice(0, 200);
  return `Caller asked about: ${topics}... (${transcript.length} messages)`;
}
