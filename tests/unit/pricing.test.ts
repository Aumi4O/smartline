import { describe, it, expect } from "vitest";
import {
  MARKUP,
  ACTIVATION_AMOUNT_CENTS,
  PLANS,
  PAYG_LIMITS,
  PRO_LIMITS,
  CREDIT_PACKS,
  USAGE_RATES,
  centsToUsd,
  isActivated,
  isPro,
} from "@/lib/pricing";

describe("pricing constants", () => {
  it("has a 20% markup", () => {
    expect(MARKUP).toBe(1.2);
  });

  it("activation deposit is $5 (500 cents)", () => {
    expect(ACTIVATION_AMOUNT_CENTS).toBe(500);
  });

  it("pro plan is $199/month", () => {
    expect(PLANS.pro.monthlyPriceCents).toBe(19900);
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

  it("includes standard $25/$50/$100/$250 credit packs", () => {
    const amounts = CREDIT_PACKS.map((p) => p.amountCents);
    expect(amounts).toEqual([2500, 5000, 10000, 25000]);
  });

  it("usage rates include markup over provider cost", () => {
    // Twilio inbound: $0.022/min provider * 1.20 = $0.0264 -> 2.64 cents/min (stored as 2.6)
    expect(USAGE_RATES.twilio_inbound_per_min_cents).toBeCloseTo(2.6, 1);
    // Twilio outbound: $0.028/min * 1.20 = $0.0336 -> 3.36 (stored as 3.4)
    expect(USAGE_RATES.twilio_outbound_per_min_cents).toBeCloseTo(3.4, 1);
    // Voice: ~$0.05/min * 1.20 = $0.06
    expect(USAGE_RATES.voice_per_min_cents).toBe(6);
    // Phone number: $1.50/mo * 1.20 = $1.80 = 180 cents
    expect(USAGE_RATES.phone_number_monthly_cents).toBe(180);
  });

  it("outbound costs more than inbound (carrier reality)", () => {
    expect(USAGE_RATES.twilio_outbound_per_min_cents).toBeGreaterThan(
      USAGE_RATES.twilio_inbound_per_min_cents
    );
  });
});

describe("centsToUsd", () => {
  it("formats whole dollars", () => {
    expect(centsToUsd(500)).toBe("$5.00");
    expect(centsToUsd(19900)).toBe("$199.00");
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
  it("returns true only for 'pro'", () => {
    expect(isPro("pro")).toBe(true);
    expect(isPro("active")).toBe(false);
    expect(isPro("starter")).toBe(false);
    expect(isPro("")).toBe(false);
  });
});
