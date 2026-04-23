import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { conversations, creditTransactions, agents, phoneNumbers } from "@/lib/db/schema";
import { eq, and, gte, sql, count } from "drizzle-orm";

export async function GET() {
  try {
    const { org } = await requireOrg();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [callStats] = await db
      .select({
        totalCalls: count(),
        totalDuration: sql<number>`COALESCE(SUM(${conversations.durationSec}), 0)`,
        totalCost: sql<number>`COALESCE(SUM(${conversations.costCents}), 0)`,
        completedCalls: sql<number>`COUNT(*) FILTER (WHERE ${conversations.status} = 'completed')`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, org.id),
          gte(conversations.startedAt, thirtyDaysAgo)
        )
      );

    const dailyCalls = await db
      .select({
        date: sql<string>`DATE(${conversations.startedAt})`,
        calls: count(),
        cost: sql<number>`COALESCE(SUM(${conversations.costCents}), 0)`,
        duration: sql<number>`COALESCE(SUM(${conversations.durationSec}), 0)`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, org.id),
          gte(conversations.startedAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`DATE(${conversations.startedAt})`)
      .orderBy(sql`DATE(${conversations.startedAt})`);

    const agentBreakdown = await db
      .select({
        agentId: conversations.agentId,
        agentName: agents.name,
        calls: count(),
        cost: sql<number>`COALESCE(SUM(${conversations.costCents}), 0)`,
        duration: sql<number>`COALESCE(SUM(${conversations.durationSec}), 0)`,
      })
      .from(conversations)
      .leftJoin(agents, eq(conversations.agentId, agents.id))
      .where(
        and(
          eq(conversations.orgId, org.id),
          gte(conversations.startedAt, thirtyDaysAgo)
        )
      )
      .groupBy(conversations.agentId, agents.name);

    const channelBreakdown = await db
      .select({
        channel: conversations.channel,
        calls: count(),
        cost: sql<number>`COALESCE(SUM(${conversations.costCents}), 0)`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, org.id),
          gte(conversations.startedAt, thirtyDaysAgo)
        )
      )
      .groupBy(conversations.channel);

    const usageByType = await db
      .select({
        type: creditTransactions.type,
        total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amountCents})), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.orgId, org.id),
          gte(creditTransactions.createdAt, thirtyDaysAgo),
          sql`${creditTransactions.amountCents} < 0`
        )
      )
      .groupBy(creditTransactions.type);

    const activeAgents = await db
      .select({ total: count() })
      .from(agents)
      .where(and(eq(agents.orgId, org.id), eq(agents.isActive, true)));

    const activeNumbers = await db
      .select({ total: count() })
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.orgId, org.id), eq(phoneNumbers.status, "active")));

    return NextResponse.json({
      period: "30d",
      summary: {
        totalCalls: callStats.totalCalls,
        completedCalls: callStats.completedCalls,
        totalDurationMin: Math.round((callStats.totalDuration || 0) / 60),
        totalCostCents: callStats.totalCost || 0,
        activeAgents: activeAgents[0]?.total || 0,
        activeNumbers: activeNumbers[0]?.total || 0,
      },
      dailyCalls,
      agentBreakdown,
      channelBreakdown,
      usageByType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
