import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getBalance, getTransactionHistory } from "@/lib/billing/credits";

export async function GET() {
  try {
    const { org } = await requireOrg();

    const [balance, transactions] = await Promise.all([
      getBalance(org.id),
      getTransactionHistory(org.id),
    ]);

    return NextResponse.json({
      balanceCents: balance,
      plan: org.plan,
      planStatus: org.planStatus,
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
