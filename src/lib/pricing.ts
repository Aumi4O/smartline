/**
 * SmartLine pricing — all amounts in cents.
 * Usage prices include a 20% platform markup over raw provider costs.
 *
 * ACTIVATION MODEL:
 *   - New users pay a $5 activation deposit (becomes real credits).
 *   - No free tier — every dollar of usage is paid.
 *   - After activation, users are on pay-as-you-go.
 *   - Optional: upgrade to Pro ($199/mo) for premium features.
 *   - $5 stays in their balance — not lost, just a deposit.
 */

export const MARKUP = 1.2;

export const ACTIVATION_AMOUNT_CENTS = 500;

export const PLANS = {
  pro: {
    name: "SmartLine Pro",
    monthlyPriceCents: 19900,
    includedAgents: 3,
    includedStorage: "5GB",
  },
} as const;

export const PAYG_LIMITS = {
  maxAgents: 1,
  maxPhoneNumbers: 1,
  maxDocuments: 5,
  maxStorageMb: 100,
} as const;

export const PRO_LIMITS = {
  maxAgents: 3,
  maxPhoneNumbers: 10,
  maxDocuments: 100,
  maxStorageMb: 5120,
} as const;

export const CREDIT_PACKS = [
  { label: "$25", amountCents: 2500 },
  { label: "$50", amountCents: 5000 },
  { label: "$100", amountCents: 10000 },
  { label: "$250", amountCents: 25000 },
] as const;

export const USAGE_RATES = {
  voice_per_min_cents: 6,
  twilio_inbound_per_min_cents: 2.6,
  twilio_outbound_per_min_cents: 3.4,
  chat_per_msg_cents: 0.2,
  sms_per_segment_cents: 1.0,
  phone_number_monthly_cents: 180,
  extra_agent_monthly_cents: 4900,
  extra_storage_per_gb_cents: 500,
} as const;

export function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export type PlanStatus = "inactive" | "active" | "pro" | "cancelled";

export function isActivated(planStatus: string): boolean {
  return planStatus === "active" || planStatus === "pro";
}

export function isPro(plan: string): boolean {
  return plan === "pro";
}
