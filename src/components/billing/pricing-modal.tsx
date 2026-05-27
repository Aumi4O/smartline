"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

/**
 * Pricing / upgrade modal — the single in-app paywall surface.
 *
 * It mirrors SmartLine's money model exactly so the UI never lies about
 * what's being charged:
 *
 *   1. Growth plan trial         → $149/mo after a 7-day trial, with a
 *                                  small usage-credit bonus for testing
 *                                  (POST /api/billing/activate when
 *                                  signed in; GET /api/billing/checkout
 *                                  otherwise)
 *
 *   2. Scale $299/mo             → for active Starter/Growth orgs upgrading
 *                                  (POST /api/billing/checkout?tier=scale
 *                                  → 303 to Stripe; we navigate top-level
 *                                  so the redirect is followed cleanly)
 *
 *   3. Credit packs ($15–$250)   → covers phone, SMS, and paid API
 *                                  usage. POST /api/billing/credits with
 *                                  { amountCents }. Required to actually
 *                                  *use* the product — plans raise limits,
 *                                  credits pay providers.
 *
 * Opened from:
 *   - Sidebar / mobile-nav UpgradeCTA
 *   - Dashboard activation card
 *   - 402 paywall responses (phone-numbers/purchase, future paid actions)
 *
 * The 402 caller can pass `checkoutUrl` to short-circuit straight to a
 * pre-minted Stripe Checkout. Otherwise the modal mints its own session
 * from whichever card the user picks.
 */

export interface PricingModalOptions {
  /** Headline shown at the top of the modal, e.g. "Phone number requires credits". */
  title?: string;
  /** Subtitle/body text explaining why the user is being asked to pay. */
  reason?: string;
  /**
   * Pre-built Stripe Checkout URL from a 402 API response. When present,
   * the credit-pack default CTA jumps straight to this URL instead of
   * re-minting a session.
   */
  checkoutUrl?: string;
  /**
   * Which card to emphasise. Defaults to "auto" (picks based on plan).
   * Set to "credits" when the user landed here from a paid-action gate.
   */
  emphasis?: "auto" | "trial" | "pro" | "credits";
}

interface PricingModalContextValue {
  open: (opts?: PricingModalOptions) => void;
  close: () => void;
}

const PricingModalContext = createContext<PricingModalContextValue | null>(null);

export function usePricingModal() {
  const ctx = useContext(PricingModalContext);
  if (!ctx) {
    throw new Error("usePricingModal must be used inside <PricingModalProvider>");
  }
  return ctx;
}

const ACCENT = "#0066FF";

const CREDIT_PACKS = [
  { label: "$15", amountCents: 1500, hint: "Starter — phone number + a few calls" },
  { label: "$25", amountCents: 2500, hint: "~300 min of inbound calls" },
  { label: "$50", amountCents: 5000, hint: "~600 min · most accounts" },
  { label: "$100", amountCents: 10000, hint: "~1,200 min" },
  { label: "$250", amountCents: 25000, hint: "Bulk · best value" },
] as const;

interface BillingData {
  plan: string;
  planStatus: string;
}

async function safeJson(
  url: string,
  init?: RequestInit
): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

export function PricingModalProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<PricingModalOptions | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lazy-fetch billing status the first time the modal is opened, then on
  // every subsequent open. Guests get 401/500 here — that's fine, we just
  // render the "not signed in" flow which still works via guest checkout.
  useEffect(() => {
    if (!opts) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/balance");
        if (!res.ok) return;
        const data = (await res.json()) as BillingData;
        if (!cancelled) setBilling(data);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opts]);

  const open = useCallback((next?: PricingModalOptions) => {
    setOpts(next ?? {});
    setErrorMsg(null);
  }, []);

  const close = useCallback(() => {
    setOpts(null);
    setBusy(null);
    setErrorMsg(null);
  }, []);

  // ESC to close, plus body scroll lock while open.
  useEffect(() => {
    if (!opts) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [opts, close]);

  const isActivated = billing
    ? billing.planStatus === "active" || billing.planStatus === "pro"
    : false;
  const isPro =
    billing?.plan === "pro" || billing?.plan === "growth" || billing?.plan === "scale";
  const isInactive = billing?.planStatus === "inactive";

  function handleTrial() {
    setBusy("trial");
    setErrorMsg(null);

    if (opts?.checkoutUrl && !isActivated) {
      window.location.href = opts.checkoutUrl;
      return;
    }

    // /api/billing/activate is the signed-in trial-start endpoint. It
    // returns JSON { url } pointing at Stripe Checkout (subscription,
    // 7-day trial, $0 today, Growth billing after).
    if (billing && isInactive) {
      void (async () => {
        const data = await safeJson("/api/billing/activate", { method: "POST" });
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        setErrorMsg(data.error || "Could not start the trial");
        setBusy(null);
      })();
      return;
    }

    // Guest or already-active — both work via the guest Checkout route
    // (it 303-redirects to the same trial-only Stripe session). We
    // navigate top-level so the redirect is followed.
    window.location.href = "/api/billing/checkout";
  }

  function handlePro() {
    if (isInactive) {
      handleTrial();
      return;
    }

    setBusy("pro");
    setErrorMsg(null);
    if (!billing) {
      window.location.href = "/api/billing/checkout";
      return;
    }

    void (async () => {
      const data = await safeJson("/api/billing/checkout?tier=scale", { method: "POST" });
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErrorMsg(data.error || "Could not start Pro checkout");
      setBusy(null);
    })();
  }

  async function handleCreditPack(amountCents: number) {
    setBusy(`credits-${amountCents}`);
    setErrorMsg(null);
    if (opts?.checkoutUrl && amountCents === 1500) {
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = opts.checkoutUrl;
      return;
    }
    const data = await safeJson("/api/billing/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents }),
    });
    if (data.url) {
      // Intentional browser redirect to Stripe — the lint rule that
      // forbids modifying values outside the component doesn't apply
      // here because window.location is the navigation API, not React
      // state. Same pattern as billing/page.tsx handleBuyCredits.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = data.url;
      return;
    }
    setErrorMsg(data.error || "Could not start credit checkout");
    setBusy(null);
  }

  const value = useMemo<PricingModalContextValue>(
    () => ({ open, close }),
    [open, close]
  );

  // Decide which card to subtly highlight. 402 paywalls usually want
  // credits emphasised; sidebar "Upgrade" wants trial/pro emphasised.
  const emphasis: NonNullable<PricingModalOptions["emphasis"]> =
    opts?.emphasis ??
    (opts?.checkoutUrl ? "credits" : isPro ? "credits" : isActivated ? "pro" : "trial");

  return (
    <PricingModalContext.Provider value={value}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pricing-modal-title"
          onClick={close}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-[1040px] overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-black"
            >
              ✕
            </button>

            <div className="max-w-[680px]">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: ACCENT }}
              >
                {isPro ? "Manage plan" : "Pick an option"}
              </p>
              <h2
                id="pricing-modal-title"
                className="mt-2 text-2xl font-semibold tracking-tight text-black sm:text-3xl"
              >
                {opts.title ||
                  (isPro
                    ? "Top up credits to keep using phone, SMS & API"
                    : isActivated
                      ? "Upgrade your plan or top up credits"
                      : "Start a plan trial or buy usage credits")}
              </h2>
              {opts.reason && (
                <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-black">
                  {opts.reason}
                </p>
              )}
              {!opts.reason && (
                <p className="mt-3 text-sm text-gray-600">
                  Free to register and explore. Paid plans include a 7-day
                  trial and $4 usage credits to test real calls. Credit packs
                  stay separate for phone, SMS, voice minutes, and API usage.
                </p>
              )}
            </div>

            {errorMsg && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </p>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {/* Card 1 — Growth plan trial */}
              <div
                className={`flex flex-col rounded-2xl border-2 p-5 ${emphasis === "trial" ? "" : "border-gray-200"}`}
                style={
                  emphasis === "trial" ? { borderColor: ACCENT } : undefined
                }
              >
                <div className="flex items-baseline justify-between">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: ACCENT }}
                  >
                    Growth plan trial
                  </p>
                  {emphasis === "trial" && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: "rgba(0, 102, 255, 0.1)",
                        color: ACCENT,
                      }}
                    >
                      Start here
                    </span>
                  )}
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-black">
                  $149
                  <span className="ml-1 text-sm font-normal text-gray-400">
                    /mo
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  7-day trial, then monthly billing unless cancelled. Includes $4 usage credits to test real calls.
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-xs text-gray-600">
                  <li>• 3 agents · 3 numbers · 500 included minutes</li>
                  <li>• Lead qualification and handoff rules</li>
                  <li>• Extra usage still uses credit packs</li>
                </ul>
                <Button
                  type="button"
                  onClick={handleTrial}
                  disabled={busy !== null || isActivated}
                  className="mt-5 w-full"
                >
                  {busy === "trial"
                    ? "Opening Stripe…"
                    : isPro
                      ? "Already on Pro"
                      : isActivated
                        ? "Already activated"
                        : "Start Growth trial →"}
                </Button>
              </div>

              {/* Card 2 — Scale plan */}
              <div
                className={`relative flex flex-col rounded-2xl p-5 text-white ${emphasis === "pro" ? "" : "border border-gray-700"}`}
                style={{
                  backgroundColor: "#000",
                  borderColor:
                    emphasis === "pro" ? ACCENT : undefined,
                  borderWidth: emphasis === "pro" ? 2 : undefined,
                }}
              >
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  {isPro ? "Current plan" : "Main plan"}
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Scale plan
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  $299
                  <span className="ml-1 text-sm font-normal text-gray-500">/mo</span>
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Higher volume, routing, analytics. Charged monthly.
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-xs text-gray-300">
                  <li>• 10 agents · 10 numbers · 2,000 included minutes</li>
                  <li>• CRM/webhook handoff and analytics</li>
                  <li>• Cancel any time from the customer portal</li>
                </ul>
                <Button
                  type="button"
                  onClick={handlePro}
                  disabled={busy !== null || isPro}
                  className="mt-5 w-full bg-white text-black hover:bg-gray-100"
                >
                  {busy === "pro"
                    ? "Opening Stripe…"
                    : isPro
                      ? "You're on Pro"
                      : isActivated
                        ? "Upgrade to Scale — $299/mo"
                        : "Start Growth trial →"}
                </Button>
              </div>

              {/* Card 3 — Credit packs (provider cost) */}
              <div
                className={`flex flex-col rounded-2xl p-5 ${emphasis === "credits" ? "border-2" : "border border-gray-200"}`}
                style={
                  emphasis === "credits" ? { borderColor: ACCENT } : undefined
                }
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Credit packs
                  </p>
                  {emphasis === "credits" && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: "rgba(0, 102, 255, 0.1)",
                        color: ACCENT,
                      }}
                    >
                      Needed for usage
                    </span>
                  )}
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-black">
                  $15
                  <span className="ml-1 text-sm font-normal text-gray-400">
                    – $250
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Pays for phone, SMS, voice minutes, and paid API. 1:1 — pack price = account credit.
                </p>
                <div className="mt-4 flex-1 space-y-1.5">
                  {CREDIT_PACKS.map((pack) => {
                    const id = `credits-${pack.amountCents}`;
                    const isBusy = busy === id;
                    return (
                      <button
                        key={pack.amountCents}
                        type="button"
                        onClick={() => handleCreditPack(pack.amountCents)}
                        disabled={busy !== null || !isActivated}
                        className="group flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          isActivated
                            ? `Buy ${pack.label} in credits`
                            : "Register and start a trial (or activate) before buying credits"
                        }
                      >
                        <div>
                          <p className="text-sm font-semibold text-black">
                            {pack.label}
                          </p>
                          <p className="text-[10px] text-gray-500">{pack.hint}</p>
                        </div>
                        <span className="text-xs font-medium text-black">
                          {isBusy ? "Opening…" : "Buy →"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!isActivated && (
                  <p className="mt-3 text-[10px] leading-snug text-gray-500">
                    You need an active account before buying credits. Start the
                    $15 starter credit pack first — the full amount becomes
                    usage credits.
                  </p>
                )}
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              Payments processed by Stripe. Cancel anytime — no contracts.
            </p>
          </div>
        </div>
      )}
    </PricingModalContext.Provider>
  );
}
