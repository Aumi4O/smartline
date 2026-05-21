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
 * Reflects the three-step money model so the button is always honest:
 *   - inactive  → "Load starter credits"
 *   - active (Starter) → "Upgrade to Pro" OR "Buy credits"
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
  const isPro = plan === "pro";
  const isInactive = planStatus === "inactive";

  const primaryLabel = isInactive
    ? "Load credits"
    : isPro
      ? "Buy credits"
      : "Upgrade to Pro";

  function openTrialModal() {
    open({
      title: "Load starter credits and start your trial",
      reason:
        "$15 today becomes usage credits in your account and starts a 7-day Pro trial. $199/mo is charged after the trial unless you cancel from the customer portal first.",
      emphasis: "trial",
    });
  }

  function openProModal() {
    open({
      title: "Upgrade to SmartLine Pro",
      reason:
        "Pro raises your limits to 3 agents, 10 numbers, 5 GB storage, and includes priority support — $199/mo, cancel any time.",
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
          ? "Load starter credits"
          : isPro
            ? "Need more credits?"
            : "Upgrade to Pro"}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
        {isPro
          ? `$${((data?.balanceCents ?? 0) / 100).toFixed(2)} balance — buy packs anytime`
          : isInactive
            ? "$15 credits · 7-day trial"
            : "$199/mo · 3 agents · 10 numbers"}
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
