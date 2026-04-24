"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivateButton } from "@/components/billing/activate-button";

interface Transaction {
  id: string;
  type: string;
  amountCents: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface BillingData {
  balanceCents: number;
  plan: string;
  planStatus: string;
  freeMinutes?: {
    allowance: number;
    usedSec: number;
    remainingSec: number;
  };
  rates?: {
    inboundCentsPerMin: number;
    outboundCentsPerMin: number;
  };
  transactions: Transaction[];
}

const creditPacks = [
  { label: "$25", amountCents: 2500 },
  { label: "$50", amountCents: 5000 },
  { label: "$100", amountCents: 10000 },
  { label: "$250", amountCents: 25000 },
];

const pricingTable = [
  { service: "Voice calls (AI)", price: "$0.06/min" },
  { service: "Phone (Twilio inbound)", price: "$0.026/min" },
  { service: "Phone (Twilio outbound)", price: "$0.034/min" },
  { service: "Chat messages", price: "$0.002/msg" },
  { service: "SMS outbound", price: "$0.010/segment" },
  { service: "Phone number", price: "$1.80/month" },
  { service: "Extra agent", price: "$49/month" },
  { service: "Extra storage", price: "$5/GB/month" },
];

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/balance");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBilling(); }, [fetchBilling]);

  async function handleSubscribe() {
    const res = await fetch("/api/billing/checkout", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function handleBuyCredits(amountCents: number) {
    const res = await fetch("/api/billing/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function handlePortal() {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  const plan = data?.plan || "starter";
  const planStatus = data?.planStatus || "inactive";
  const balance = data?.balanceCents ?? 0;
  const isInactive = planStatus === "inactive";
  const isPro = plan === "pro";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Billing</h1>
        <p className="mt-1 text-gray-500">Manage your credits and subscription.</p>
      </div>

      <div className="max-w-[768px] space-y-6">

        {/* Activation gate */}
        {isInactive && (
          <Card>
            <CardHeader>
              <CardTitle>Activate your account — $5 today</CardTitle>
              <CardDescription>
                Pay $5 now to unlock full Pro access for 3 days. Auto-renews to $199/mo Pro after day 3 unless you cancel. The $5 converts into usage credits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-[320px]">
                <ActivateButton />
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Have a launch code? Enter <span className="font-mono text-gray-600">TESTER</span> at Stripe Checkout for $150 off your first month.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Plan — only show after activation */}
        {!isInactive && (
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-black">
                    {isPro ? "Pro" : "Starter"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isPro ? "$199/mo — 3 agents, 5GB storage, priority support" : "Pay-as-you-go — 1 agent, 100MB storage"}
                  </p>
                </div>
                {isPro ? (
                  <div className="flex flex-col items-end gap-2">
                    <Button variant="secondary" onClick={handlePortal}>
                      Manage subscription
                    </Button>
                    <button
                      onClick={handlePortal}
                      className="text-xs text-gray-500 underline hover:text-black"
                    >
                      Cancel plan
                    </button>
                  </div>
                ) : (
                  <Button onClick={handleSubscribe}>
                    Upgrade to Pro — $199/mo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Free monthly minutes — only show after activation */}
        {!isInactive && data?.freeMinutes && (
          <Card>
            <CardHeader>
              <CardTitle>Free Call Minutes</CardTitle>
              <CardDescription>
                {data.freeMinutes.allowance} minutes included every calendar month — perfect for testing your agent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-4xl font-semibold text-black">
                {Math.floor(data.freeMinutes.remainingSec / 60)}
                <span className="ml-2 text-lg font-normal text-gray-500">
                  / {data.freeMinutes.allowance} min remaining
                </span>
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full bg-black"
                  style={{
                    width: `${Math.min(
                      100,
                      (data.freeMinutes.usedSec /
                        Math.max(1, data.freeMinutes.allowance * 60)) *
                        100
                    ).toFixed(1)}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Free minutes apply first. After you use them, calls bill at{" "}
                <span className="font-mono text-gray-700">
                  ${((data.rates?.inboundCentsPerMin ?? 8.6) / 100).toFixed(3)}
                </span>{" "}
                / minute from your credit balance.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Credits — only show after activation */}
        {!isInactive && (
          <Card>
            <CardHeader>
              <CardTitle>Credit Balance</CardTitle>
              <CardDescription>Pay-as-you-go usage credits</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-4xl font-semibold text-black">
                {loading ? "..." : `$${(balance / 100).toFixed(2)}`}
              </p>

              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-black">Buy Credits</p>
                <div className="flex gap-2">
                  {creditPacks.map((pack) => (
                    <Button
                      key={pack.amountCents}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleBuyCredits(pack.amountCents)}
                    >
                      {pack.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        {!isInactive && (
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {(!data?.transactions || data.transactions.length === 0) ? (
                <p className="py-4 text-center text-sm text-gray-400">No transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
                      <div>
                        <p className="text-sm text-black">{tx.description}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-sm font-medium ${tx.amountCents >= 0 ? "text-black" : "text-gray-500"}`}>
                        {tx.amountCents >= 0 ? "+" : ""}${(tx.amountCents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pricing — always visible */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>All usage includes 20% service fee</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pricingTable.map((item) => (
                <div key={item.service} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
                  <span className="text-sm text-black">{item.service}</span>
                  <span className="text-sm font-medium text-black">{item.price}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
