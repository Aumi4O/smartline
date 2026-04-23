import { db } from "@/lib/db";
import { creditBalances, creditTransactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function getBalance(orgId: string): Promise<number> {
  const row = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.orgId, orgId),
  });
  return row?.balanceCents ?? 0;
}

export async function addCredits(
  orgId: string,
  amountCents: number,
  description: string,
  type: "purchase" | "bonus" | "refund" = "purchase",
  metadata: Record<string, unknown> = {}
) {
  const [updated] = await db
    .update(creditBalances)
    .set({
      balanceCents: sql`${creditBalances.balanceCents} + ${amountCents}`,
      updatedAt: new Date(),
    })
    .where(eq(creditBalances.orgId, orgId))
    .returning();

  await db.insert(creditTransactions).values({
    orgId,
    type,
    amountCents,
    balanceAfter: updated.balanceCents,
    description,
    metadata,
  });

  return updated.balanceCents;
}

export async function deductCredits(
  orgId: string,
  amountCents: number,
  description: string,
  type: "usage" | "phone_number" | "extra_agent" = "usage",
  metadata: Record<string, unknown> = {}
): Promise<{ success: boolean; balance: number }> {
  const current = await getBalance(orgId);
  if (current < amountCents) {
    return { success: false, balance: current };
  }

  const [updated] = await db
    .update(creditBalances)
    .set({
      balanceCents: sql`GREATEST(${creditBalances.balanceCents} - ${amountCents}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(creditBalances.orgId, orgId))
    .returning();

  await db.insert(creditTransactions).values({
    orgId,
    type,
    amountCents: -amountCents,
    balanceAfter: updated.balanceCents,
    description,
    metadata,
  });

  return { success: true, balance: updated.balanceCents };
}

export async function getTransactionHistory(orgId: string, limit = 20) {
  return db.query.creditTransactions.findMany({
    where: eq(creditTransactions.orgId, orgId),
    orderBy: (tx, { desc }) => [desc(tx.createdAt)],
    limit,
  });
}

export async function getAutoTopupSettings(orgId: string) {
  const row = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.orgId, orgId),
  });
  return {
    autoTopup: row?.autoTopup ?? false,
    topupAmount: row?.topupAmount ?? 2500,
    topupThreshold: row?.topupThreshold ?? 500,
  };
}

export async function updateAutoTopup(
  orgId: string,
  enabled: boolean,
  amount?: number,
  threshold?: number
) {
  await db
    .update(creditBalances)
    .set({
      autoTopup: enabled,
      ...(amount !== undefined ? { topupAmount: amount } : {}),
      ...(threshold !== undefined ? { topupThreshold: threshold } : {}),
      updatedAt: new Date(),
    })
    .where(eq(creditBalances.orgId, orgId));
}
