"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePricingModal } from "@/components/billing/pricing-modal";

interface BillingSummary {
  plan: string;
  planStatus: string;
  balanceCents: number;
}

/**
 * Small upgrade affordance for the sidebar and mobile nav.
 *
 * Reflects the plan + credits model so the button is always honest:
 *   - inactive  → "Start plan"
 *   - active (Starter) → "Upgrade plan" OR "Buy credits"
 *   - pro       → "Buy credits"
 *
 * Every variant opens the same pricing modal, which is the canonical
 * paywall surface. The full version shows two compact buttons (primary +
 * "Buy credits") so customers always have a one-click path to add
 * provider-cost credits, regardless of plan.
 */
export function UpgradeCTA({ compact = false }: { compact?: boolean } = {}) {
  const [data, setData] = useState<BillingSummary | null>(null);
  const { open } = usePricingModal();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/balance");
        if (!res.ok) return;
        const body = (await res.json()) as BillingSummary;
        if (!cancelled) setData(body);
      } catch {
        // Silent — we just won't show plan-specific copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const plan = data?.plan ?? "starter";
  const planStatus = data?.planStatus ?? "inactive";
  const isPro = plan === "pro" || plan === "growth" || plan === "scale";
  const isInactive = planStatus === "inactive";

  const primaryLabel = isInactive
    ? "Start plan"
    : isPro
      ? "Buy credits"
      : "Upgrade plan";

  function openTrialModal() {
    open({
      title: "Start your Growth trial",
      reason:
        "Growth starts with a 7-day trial and $4 in usage credits for real call testing. $149/mo is charged after the trial unless you cancel from the customer portal first.",
      emphasis: "trial",
    });
  }

  function openProModal() {
    open({
      title: "Upgrade to SmartLine Scale",
      reason:
        "Scale raises your limits to 10 agents, 10 numbers, 2,000 included minutes, routing, and analytics — $299/mo, cancel any time.",
      emphasis: "pro",
    });
  }

  function openCreditsModal() {
    open({
      title: "Buy credit packs",
      reason:
        "Credits cover the provider cost of phone numbers, voice minutes, SMS, and paid API. They are separate from the Pro subscription.",
      emphasis: "credits",
    });
  }

  function handlePrimary() {
    if (isInactive) return openTrialModal();
    if (isPro) return openCreditsModal();
    return openProModal();
  }

  if (compact) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={handlePrimary}
        className="w-full"
        style={{ backgroundColor: "#0066FF" }}
      >
        {primaryLabel}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {isPro ? "Plan · Pro" : isInactive ? "Plan · Free" : "Plan · Starter"}
      </p>
      <p className="mt-1 text-sm font-semibold text-black">
        {isInactive
          ? "Start a plan trial"
          : isPro
            ? "Need more credits?"
            : "Upgrade your plan"}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
        {isPro
          ? `$${((data?.balanceCents ?? 0) / 100).toFixed(2)} balance — buy packs anytime`
          : isInactive
            ? "$149/mo Growth · 7-day trial"
            : "$299/mo · 10 agents · routing"}
      </p>
      <Button
        type="button"
        size="sm"
        onClick={handlePrimary}
        className="mt-3 w-full"
        style={{ backgroundColor: "#0066FF" }}
      >
        {primaryLabel} →
      </Button>
      {/* Credits affordance is always available — Pro raises limits, but
          credits are what actually pay providers. Showing both makes both
          steps reachable in one click without burying credits one level
          deeper. Hidden on the Pro variant because the primary already is
          credits. */}
      {!isPro && (
        <button
          type="button"
          onClick={openCreditsModal}
          className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-gray-50"
        >
          Buy credits ($15+)
        </button>
      )}
    </div>
  );
}
