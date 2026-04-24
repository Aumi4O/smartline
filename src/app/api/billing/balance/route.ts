import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import {
  getBalance,
  getTransactionHistory,
  getFreeMinutesStatus,
} from "@/lib/billing/credits";
import {
  INBOUND_CALL_RATE_CENTS_PER_MIN,
  OUTBOUND_CALL_RATE_CENTS_PER_MIN,
} from "@/lib/pricing";

export async function GET() {
  try {
    const { org } = await requireOrg();

    const [balance, transactions, freeMinutes] = await Promise.all([
      getBalance(org.id),
      getTransactionHistory(org.id),
      getFreeMinutesStatus(org.id),
    ]);

    return NextResponse.json({
      balanceCents: balance,
      plan: org.plan,
      planStatus: org.planStatus,
      freeMinutes: {
        allowance: freeMinutes.allowance,
        usedSec: freeMinutes.usedSec,
        remainingSec: freeMinutes.remainingSec,
      },
      rates: {
        inboundCentsPerMin: INBOUND_CALL_RATE_CENTS_PER_MIN,
        outboundCentsPerMin: OUTBOUND_CALL_RATE_CENTS_PER_MIN,
      },
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amountCents: tx.amountCents,
        balanceAfter: tx.balanceAfter,
        description: tx.description,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
