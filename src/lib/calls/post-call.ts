import { db } from "@/lib/db";
import { conversations, creditTransactions } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { deductCredits } from "@/lib/billing/credits";
import {
  USAGE_RATES,
  FREE_CALL_MINUTES_MONTHLY,
  INBOUND_CALL_RATE_CENTS_PER_MIN,
} from "@/lib/pricing";
import { fireWebhook } from "@/lib/webhooks/subscriber-webhook";

function startOfCalendarMonthUTC(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

/**
 * Seconds of call usage this org has already consumed this calendar month.
 * Counted from credit_transactions rows tagged as "usage" with durationSec
 * stored in metadata (whether free or paid — both are tallied for the cap).
 */
async function getCallSecondsUsedThisMonth(orgId: string): Promise<number> {
  const monthStart = startOfCalendarMonthUTC();
  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM( (${creditTransactions.metadata}->>'durationSec')::int ), 0)`,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.orgId, orgId),
        eq(creditTransactions.type, "usage"),
        gte(creditTransactions.createdAt, monthStart)
      )
    );
  return Number(rows[0]?.total ?? 0);
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export async function processCallEnd(
  conversationId: string,
  orgId: string,
  durationSec: number,
  transcript: { role: string; content: string }[]
) {
  const safeDuration = Math.max(0, Math.floor(durationSec));

  // How many seconds fall under the monthly free allowance.
  const alreadyUsedSec = await getCallSecondsUsedThisMonth(orgId);
  const freeCapSec = FREE_CALL_MINUTES_MONTHLY * 60;
  const freeRemainingSec = Math.max(0, freeCapSec - alreadyUsedSec);
  const freeAppliedSec = Math.min(freeRemainingSec, safeDuration);
  const billableSec = safeDuration - freeAppliedSec;

  // Combined per-second rate, rounded up to the nearest whole cent at the end.
  const voiceFraction = (billableSec / 60) * USAGE_RATES.voice_per_min_cents;
  const twilioFraction =
    (billableSec / 60) * USAGE_RATES.twilio_inbound_per_min_cents;
  const totalCostCents = Math.ceil(voiceFraction + twilioFraction);

  const ratePerMin = INBOUND_CALL_RATE_CENTS_PER_MIN;
  const durStr = formatDuration(safeDuration);

  let chargeDescription: string;
  if (billableSec === 0) {
    chargeDescription = `Phone call — ${durStr} (free monthly minutes)`;
  } else if (freeAppliedSec > 0) {
    chargeDescription = `Phone call — ${durStr} (${formatDuration(
      freeAppliedSec
    )} free + ${formatDuration(billableSec)} @ $${(ratePerMin / 100).toFixed(
      3
    )}/min)`;
  } else {
    chargeDescription = `Phone call — ${durStr} @ $${(ratePerMin / 100).toFixed(
      3
    )}/min`;
  }

  if (totalCostCents > 0) {
    await deductCredits(orgId, totalCostCents, chargeDescription, "usage", {
      conversationId,
      durationSec: safeDuration,
      billableSec,
      freeAppliedSec,
      voiceRateCentsPerMin: USAGE_RATES.voice_per_min_cents,
      twilioRateCentsPerMin: USAGE_RATES.twilio_inbound_per_min_cents,
    });
  } else if (safeDuration > 0) {
    // No money moved, but we still record a ledger row so the Calls page and
    // monthly free-minute counter stay in sync. balanceAfter is unchanged.
    const [balanceRow] = await db
      .select({ balance: sql<number>`COALESCE(balance_cents, 0)` })
      .from(sql`credit_balances`)
      .where(sql`org_id = ${orgId}::uuid`);

    await db.insert(creditTransactions).values({
      orgId,
      type: "usage",
      amountCents: 0,
      balanceAfter: Number(balanceRow?.balance ?? 0),
      description: chargeDescription,
      metadata: {
        conversationId,
        durationSec: safeDuration,
        billableSec: 0,
        freeAppliedSec,
      },
    });
  }

  let summary = "";
  try {
    summary = generateQuickSummary(transcript);
  } catch {
    summary = `${Math.ceil(safeDuration / 60)} minute call`;
  }

  await db
    .update(conversations)
    .set({
      status: "completed",
      summary,
      durationSec: safeDuration,
      costCents: totalCostCents,
      endedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));

  fireWebhook(orgId, "call.completed", {
    conversationId,
    durationSec: safeDuration,
    costCents: totalCostCents,
    freeAppliedSec,
    summary,
  }).catch(() => {});

  return { totalCostCents, freeAppliedSec, summary };
}

function generateQuickSummary(
  transcript: { role: string; content: string }[]
): string {
  const userMessages = transcript
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  if (userMessages.length === 0) return "No conversation recorded";

  const topics = userMessages.slice(0, 3).join(" ").slice(0, 200);
  return `Caller asked about: ${topics}... (${transcript.length} messages)`;
}
