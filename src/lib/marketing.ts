import { cn } from "@/lib/utils";

/**
 * Public landing / conversion URLs (driven by env for demos and A/B).
 */

/**
 * Primary "Start for $5" CTA.
 *
 * The $5 is a starter credit pack (not a fee) — it lands as usage credits
 * in the new org's balance and is spent only on calls/SMS/API. Loading it
 * also unlocks Pro for 3 days, after which Pro auto-starts at $199/mo.
 *
 * Hard-coded to /api/billing/checkout — a guest-friendly endpoint that
 * creates a Stripe Checkout Session and 303-redirects the visitor
 * straight to Stripe.
 *
 * No email form on our side. Stripe's own page collects the email and the
 * card. On payment, our webhook creates the user+org and emails a magic
 * sign-in link.
 *
 * One click on any homepage button → Stripe. Never goes through /login.
 */
export const START_LOGIN_HREF = "/api/billing/checkout";

/** Tester promo CTA — auto-applies the TESTER coupon for $150 off first month. */
export const START_LOGIN_HREF_TESTER = "/api/billing/checkout?promo=TESTER";

/** E.164 demo line for "Hear It Talk" (e.g. +18005551212). If unset, we scroll to #how. */
export const DEMO_PHONE_E164 = process.env.NEXT_PUBLIC_DEMO_PHONE_E164?.trim() || "";

export function getHearItTalkHref(): string {
  if (DEMO_PHONE_E164) {
    return `tel:${DEMO_PHONE_E164.replace(/\s/g, "")}`;
  }
  return "#how";
}

/** Same visual weight as <Button size="lg" variant="secondary" className="w-full sm:w-auto"> for <a>. */
export function hearItTalkClassName() {
  return cn(
    "inline-flex w-full h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 text-base font-medium text-black transition-all hover:bg-gray-50 sm:w-auto",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
  );
}
