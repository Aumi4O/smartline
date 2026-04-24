import { cn } from "@/lib/utils";

/**
 * Public landing / conversion URLs (driven by env for demos and A/B).
 */

/**
 * Primary "Start for $5" CTA.
 *
 * Points at /api/billing/checkout — a guest-friendly endpoint that creates
 * a Stripe Checkout Session ($5 today + 3-day trial + $199/mo auto-start)
 * and 302-redirects the visitor straight to Stripe.
 *
 * No email form on our side. Stripe's own page collects the email and the
 * card. On payment, our webhook creates the user+org and emails a magic
 * sign-in link.
 *
 * One click on any homepage button → Stripe.
 */
export const START_LOGIN_HREF =
  process.env.NEXT_PUBLIC_START_URL?.trim() || "/api/billing/checkout";

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
