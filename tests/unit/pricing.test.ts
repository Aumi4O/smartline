import { describe, it, expect } from "vitest";
import {
  MARKUP,
  STRIPE_FIXED_FEE_CENTS,
  STRIPE_PERCENT_FEE,
  CREDIT_PACK_PAYMENT_FEE_RESERVE_CENTS,
  ACTIVATION_AMOUNT_CENTS,
  PLAN_TRIAL_CREDIT_CENTS,
  PRO_TRIAL_DAYS,
  PLANS,
  SUBSCRIPTION_TIERS,
  PAYG_LIMITS,
  PRO_LIMITS,
  CREDIT_PACKS,
  USAGE_RATES,
  centsToUsd,
  stripeFeeForCharge,
  isActivated,
  isPro,
} from "@/lib/pricing";

describe("pricing constants", () => {
  it("has a 20% markup", () => {
    expect(MARKUP).toBe(1.2);
  });

  it("models Stripe card processing fees", () => {
    expect(STRIPE_PERCENT_FEE).toBe(0.029);
    expect(STRIPE_FIXED_FEE_CENTS).toBe(30);
    expect(CREDIT_PACK_PAYMENT_FEE_RESERVE_CENTS).toBe(30);
  });

  it("activation deposit is $15 (1500 cents)", () => {
    expect(ACTIVATION_AMOUNT_CENTS).toBe(1500);
  });

  it("paid plan checkout grants $4 of trial usage credits", () => {
    expect(PLAN_TRIAL_CREDIT_CENTS).toBe(400);
  });

  it("paid plan checkout trial is 7 days", () => {
    expect(PRO_TRIAL_DAYS).toBe(7);
  });

  it("has $49/$149/$299 monthly tiers", () => {
    expect(SUBSCRIPTION_TIERS.starter.monthlyPriceCents).toBe(4900);
    expect(SUBSCRIPTION_TIERS.growth.monthlyPriceCents).toBe(14900);
    expect(SUBSCRIPTION_TIERS.scale.monthlyPriceCents).toBe(29900);
  });

  it("legacy pro alias points at Growth", () => {
    expect(PLANS.pro.monthlyPriceCents).toBe(14900);
    expect(PLANS.pro.includedAgents).toBeGreaterThan(0);
  });

  it("payg limits are stricter than pro limits", () => {
    expect(PAYG_LIMITS.maxAgents).toBeLessThan(PRO_LIMITS.maxAgents);
    expect(PAYG_LIMITS.maxPhoneNumbers).toBeLessThan(PRO_LIMITS.maxPhoneNumbers);
    expect(PAYG_LIMITS.maxStorageMb).toBeLessThan(PRO_LIMITS.maxStorageMb);
  });

  it("credit packs are ascending in value", () => {
    const amounts = CREDIT_PACKS.map((p) => p.amountCents);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]).toBeGreaterThan(amounts[i - 1]);
    }
  });

  it("includes standard $15/$25/$50/$100/$250 credit packs", () => {
    const amounts = CREDIT_PACKS.map((p) => p.amountCents);
    expect(amounts).toEqual([1500, 2500, 5000, 10000, 25000]);
  });

  it("usage rates include markup plus internal Stripe fee coverage", () => {
    expect(USAGE_RATES.twilio_inbound_per_min_cents).toBeCloseTo(2.76, 2);
    expect(USAGE_RATES.twilio_outbound_per_min_cents).toBeCloseTo(3.52, 2);
    expect(USAGE_RATES.voice_per_min_cents).toBeCloseTo(6.28, 2);
    expect(USAGE_RATES.phone_number_monthly_cents).toBe(189);
  });

  it("outbound costs more than inbound (carrier reality)", () => {
    expect(USAGE_RATES.twilio_outbound_per_min_cents).toBeGreaterThan(
      USAGE_RATES.twilio_inbound_per_min_cents
    );
  });
});

describe("Stripe fee accounting", () => {
  it("calculates fees for customer-facing credit pack charges", () => {
    expect(stripeFeeForCharge(1500)).toBe(74);
  });
});

describe("centsToUsd", () => {
  it("formats whole dollars", () => {
    expect(centsToUsd(500)).toBe("$5.00");
    expect(centsToUsd(14900)).toBe("$149.00");
  });

  it("formats cents", () => {
    expect(centsToUsd(123)).toBe("$1.23");
    expect(centsToUsd(1)).toBe("$0.01");
  });

  it("formats zero", () => {
    expect(centsToUsd(0)).toBe("$0.00");
  });

  it("handles large amounts", () => {
    expect(centsToUsd(1234567)).toBe("$12345.67");
  });

  it("handles negative amounts (refunds)", () => {
    expect(centsToUsd(-500)).toBe("$-5.00");
  });
});

describe("isActivated", () => {
  it("returns true for active plan status", () => {
    expect(isActivated("active")).toBe(true);
  });

  it("returns true for pro plan status", () => {
    expect(isActivated("pro")).toBe(true);
  });

  it("returns false for inactive", () => {
    expect(isActivated("inactive")).toBe(false);
  });

  it("returns false for cancelled", () => {
    expect(isActivated("cancelled")).toBe(false);
  });

  it("returns false for trialing", () => {
    expect(isActivated("trialing")).toBe(false);
  });

  it("returns false for empty or unknown", () => {
    expect(isActivated("")).toBe(false);
    expect(isActivated("garbage")).toBe(false);
  });
});

describe("isPro", () => {
  it("returns true for paid plan names", () => {
    expect(isPro("pro")).toBe(true);
    expect(isPro("growth")).toBe(true);
    expect(isPro("scale")).toBe(true);
    expect(isPro("active")).toBe(false);
    expect(isPro("starter")).toBe(false);
    expect(isPro("")).toBe(false);
  });
});
