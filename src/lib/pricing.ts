/**
 * SmartLine pricing — all amounts in cents.
 * Usage prices include a 20% platform markup over raw provider costs, plus
 * enough internal payment-fee coverage to protect the usable cash collected.
 *
 * STARTER CREDITS MODEL:
 *   - Registration is free. Users can create an org, profile, and agent
 *     before paying.
 *   - The first provider-cost action loads a $15 starter credit pack
 *     (NOT a service fee — the pack amount lands in the org's credit balance).
 *   - Loading credits also kicks off a 7-day Pro trial; Pro auto-starts
 *     at $199/mo after the trial.
 *   - Cancel in the Customer Portal before trial ends to avoid the
 *     first $199. The $15 starter credits are kept either way.
 */

export const MARKUP = 1.2;
export const STRIPE_PERCENT_FEE = 0.029;
export const STRIPE_FIXED_FEE_CENTS = 30;
export const CREDIT_PACK_PAYMENT_FEE_RESERVE_CENTS = 30;

/** Cents loaded as starter usage credits at sign-up. Renamed from
 *  "activation amount" for clarity — this is not a fee, it is credit. */
export const ACTIVATION_AMOUNT_CENTS = 1500;

/** Pro subscription trial in Checkout (first $199 is after this many days). */
export const PRO_TRIAL_DAYS = 7;

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
  { label: "$15", amountCents: 1500 },
  { label: "$25", amountCents: 2500 },
  { label: "$50", amountCents: 5000 },
  { label: "$100", amountCents: 10000 },
  { label: "$250", amountCents: 25000 },
] as const;

function paygRate(providerCostCents: number): number {
  return Number(
    (
      (providerCostCents * MARKUP) /
      (1 - STRIPE_PERCENT_FEE) +
      CREDIT_PACK_PAYMENT_FEE_RESERVE_CENTS / (ACTIVATION_AMOUNT_CENTS / providerCostCents)
    ).toFixed(2)
  );
}

export const USAGE_RATES = {
  voice_per_min_cents: paygRate(5),
  twilio_inbound_per_min_cents: paygRate(2.2),
  twilio_outbound_per_min_cents: paygRate(2.8),
  chat_per_msg_cents: paygRate(0.17),
  sms_per_segment_cents: Math.ceil(paygRate(0.83)),
  phone_number_monthly_cents: Math.ceil(paygRate(150)),
  extra_agent_monthly_cents: Math.ceil(paygRate(4083)),
  extra_storage_per_gb_cents: Math.ceil(paygRate(417)),
} as const;

/**
 * Each org gets this many free call-minutes per calendar month.
 * Keeps test calls from scaring away new customers.
 */
export const FREE_CALL_MINUTES_MONTHLY = 30;

/** Combined voice + inbound phone rate in cents/minute (for display). */
export const INBOUND_CALL_RATE_CENTS_PER_MIN =
  USAGE_RATES.voice_per_min_cents + USAGE_RATES.twilio_inbound_per_min_cents;

/** Combined voice + outbound phone rate in cents/minute (for display). */
export const OUTBOUND_CALL_RATE_CENTS_PER_MIN =
  USAGE_RATES.voice_per_min_cents + USAGE_RATES.twilio_outbound_per_min_cents;

export function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function stripeFeeForCharge(chargeCents: number): number {
  if (chargeCents <= 0) return 0;
  return Math.ceil(chargeCents * STRIPE_PERCENT_FEE + STRIPE_FIXED_FEE_CENTS);
}

export type PlanStatus = "inactive" | "active" | "pro" | "cancelled";

export function isActivated(planStatus: string): boolean {
  return planStatus === "active" || planStatus === "pro";
}

export function isPro(plan: string): boolean {
  return plan === "pro";
}
