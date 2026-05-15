import { cn } from "@/lib/utils";

/**
 * Public landing / conversion URLs (driven by env for demos and A/B).
 */

/**
 * Registration is free. The app asks for the $15 starter credit pack only
 * when the customer starts a provider-cost action such as registering a
 * phone number or running paid API usage.
 */
export const START_LOGIN_HREF = "/login";

/** Tester promo CTA — auto-applies the TESTER coupon for $150 off first month. */
export const START_LOGIN_HREF_TESTER = "/api/billing/checkout?promo=TESTER";

/** E.164 demo line for "Hear It Talk" (e.g. +18005551212). If unset, we scroll to #strawberry-demo. */
export const DEMO_PHONE_E164 = process.env.NEXT_PUBLIC_DEMO_PHONE_E164?.trim() || "";

/**
 * Public URL of the SmartLine browser demo.
 * Set NEXT_PUBLIC_STRAWBERRY_VOICE_DEMO_URL to the live Lead Agent Studio demo URL.
 */
export const STRAWBERRY_VOICE_DEMO_URL =
  process.env.NEXT_PUBLIC_STRAWBERRY_VOICE_DEMO_URL?.trim() || "/strawberry-demo.html";

export function getHearItTalkHref(): string {
  if (STRAWBERRY_VOICE_DEMO_URL) {
    return "#strawberry-demo";
  }
  if (DEMO_PHONE_E164) {
    return `tel:${DEMO_PHONE_E164.replace(/\s/g, "")}`;
  }
  return "#strawberry-demo";
}

export function getStrawberryVoiceDemoUrl(): string {
  return STRAWBERRY_VOICE_DEMO_URL;
}

/** Same visual weight as <Button size="lg" variant="secondary" className="w-full sm:w-auto"> for <a>. */
export function hearItTalkClassName() {
  return cn(
    "inline-flex w-full h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 text-base font-medium text-black transition-all hover:bg-gray-50 sm:w-auto",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
  );
}
