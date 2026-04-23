import { auth } from "@/lib/auth";
import { getOrCreateOrg } from "@/lib/org";
import { getBalance } from "@/lib/billing/credits";
import { isActivated, isPro } from "@/lib/pricing";
import { db } from "@/lib/db";
import { agents, phoneNumbers, conversations, businessProfiles } from "@/lib/db/schema";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ActivateButton } from "@/components/billing/activate-button";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const org = await getOrCreateOrg(session.user.id, session.user.email!);
  const balance = await getBalance(org.id);
  const activated = isActivated(org.planStatus);

  if (!activated) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-black">Welcome to SmartLine</h1>
          <p className="mt-1 text-gray-500">
            Activate your account to start building AI voice agents.
          </p>
        </div>

        <Card className="max-w-[480px]">
          <CardHeader>
            <CardTitle>Activate Your Account</CardTitle>
            <CardDescription>
              Pay a one-time $5 deposit to get started. This converts to $5 in usage credits — nothing is lost.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2 text-sm text-gray-500">
                <p>With your $5 you can:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Make ~80 minutes of AI voice calls</li>
                  <li>Send ~250 chat messages</li>
                  <li>Test your agent end-to-end</li>
                </ul>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <ActivateButton />
              </div>
              <p className="text-xs text-gray-400">
                No subscription required. Pay-as-you-go. Buy more credits anytime.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [agentCount] = await db
    .select({ total: count() })
    .from(agents)
    .where(and(eq(agents.orgId, org.id), eq(agents.isActive, true)));

  const [phoneCount] = await db
    .select({ total: count() })
    .from(phoneNumbers)
    .where(and(eq(phoneNumbers.orgId, org.id), eq(phoneNumbers.status, "active")));

  const [callStats] = await db
    .select({
      totalCalls: count(),
      totalCost: sql<number>`COALESCE(SUM(${conversations.costCents}), 0)`,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, org.id),
        gte(conversations.startedAt, thirtyDaysAgo)
      )
    );

  const recentCalls = await db.query.conversations.findMany({
    where: eq(conversations.orgId, org.id),
    orderBy: (c, { desc }) => [desc(c.startedAt)],
    limit: 5,
    with: { agent: true },
  });

  const profile = await db.query.businessProfiles.findFirst({
    where: eq(businessProfiles.orgId, org.id),
  });

  const hasAgent = (agentCount?.total || 0) > 0;
  const hasPhone = (phoneCount?.total || 0) > 0;
  const hasProfile = !!(profile && profile.businessName);

  const stats = [
    { title: "Active Agents", value: String(agentCount?.total || 0), description: hasAgent ? "Ready to take calls" : "Create your first agent" },
    { title: "Total Calls (30d)", value: String(callStats?.totalCalls || 0), description: "Last 30 days" },
    { title: "Credit Balance", value: `$${(balance / 100).toFixed(2)}`, description: "Available credits" },
    { title: "Plan", value: isPro(org.plan) ? "Pro" : "Starter", description: isPro(org.plan) ? "$199/mo active" : "Pay-as-you-go" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Dashboard</h1>
        <p className="mt-1 text-gray-500">
          Welcome back, {session.user.name || session.user.email}.
        </p>
      </div>

      <OnboardingWizard
        activated={activated}
        hasAgent={hasAgent}
        hasPhone={hasPhone}
        hasProfile={hasProfile}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader>
              <CardDescription>{stat.title}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-400">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link href="/agents/new">
                <Button>Create Agent</Button>
              </Link>
              <Link href="/phone-numbers">
                <Button variant="secondary">Get Phone Number</Button>
              </Link>
              <Link href="/knowledge">
                <Button variant="secondary">Business Info</Button>
              </Link>
              <Link href="/billing">
                <Button variant="secondary">Buy Credits</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
            <CardDescription>Latest conversations</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No calls yet. Set up an agent and phone number to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {recentCalls.map((call) => (
                  <Link key={call.id} href={`/calls/${call.id}`}>
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-black">
                          {call.callerPhone || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {call.agent?.name} · {call.channel}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {new Date(call.startedAt).toLocaleDateString()}
                        </p>
                        {call.costCents && (
                          <p className="text-xs font-medium text-black">
                            ${(call.costCents / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Usage This Month</CardTitle>
                <CardDescription>Credit consumption (30 days)</CardDescription>
              </div>
              <Link href="/analytics">
                <Button variant="ghost" size="sm">View Analytics →</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Voice (OpenAI Realtime)", value: `$${((callStats?.totalCost || 0) / 100).toFixed(2)}` },
                { label: "Phone Numbers", value: `${phoneCount?.total || 0} active` },
                { label: "Agents", value: `${agentCount?.total || 0} active` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
                  <span className="text-sm text-black">{item.label}</span>
                  <span className="text-sm font-medium text-black">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
