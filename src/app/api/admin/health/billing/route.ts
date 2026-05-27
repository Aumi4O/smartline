import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

/**
 * Admin-only billing wiring health check.
 *
 * Returns a JSON report:
 *   - STRIPE_SECRET_KEY present
 *   - STRIPE_WEBHOOK_SECRET present
 *   - Optional tier Stripe price ids present and resolve at Stripe
 *   - OPENAI_WEBHOOK_SECRET present
 *   - TESTER promo code exists & active
 *
 * Gated: caller must be the owner/admin of at least one org.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerMembership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(orgMemberships.userId, session.user.id),
      eq(orgMemberships.role, "owner")
    ),
  });

  if (!ownerMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = {
    env: {
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
      STRIPE_STARTER_PRICE_ID: !!process.env.STRIPE_STARTER_PRICE_ID,
      STRIPE_GROWTH_PRICE_ID: !!process.env.STRIPE_GROWTH_PRICE_ID,
      STRIPE_SCALE_PRICE_ID: !!process.env.STRIPE_SCALE_PRICE_ID,
      OPENAI_WEBHOOK_SECRET: !!process.env.OPENAI_WEBHOOK_SECRET,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      OPENAI_SIP_PROJECT_ID: !!process.env.OPENAI_SIP_PROJECT_ID,
      OPENAI_ADMIN_KEY: !!process.env.OPENAI_ADMIN_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || null,
    },
    stripe: {
      prices: [] as Array<{
        tier: string;
        priceId: string;
        active: boolean;
        amount: number | null;
        currency: string;
        recurring: string | null;
      }>,
      testerPromoActive: false as boolean,
      testerPromoCode: null as string | null,
      testerCouponId: null as string | null,
      testerCouponValid: false as boolean,
      testerCouponAmountOff: null as number | null,
      testerCouponPercentOff: null as number | null,
      testerCouponDuration: null as string | null,
      testerCouponAppliesToProducts: null as string[] | null,
      error: null as string | null,
    },
  };

  try {
    for (const [tier, priceId] of [
      ["starter", process.env.STRIPE_STARTER_PRICE_ID],
      ["growth", process.env.STRIPE_GROWTH_PRICE_ID],
      ["scale", process.env.STRIPE_SCALE_PRICE_ID],
    ] as const) {
      if (!priceId) continue;
      const price = await stripe.prices.retrieve(priceId);
      report.stripe.prices.push({
        tier,
        priceId,
        active: price.active,
        amount: price.unit_amount,
        currency: price.currency,
        recurring: price.recurring?.interval || null,
      });
    }

    // In Stripe SDK v22 the PromotionCode type nests the coupon as
    // `promo.promotion.coupon`, typed `string | Stripe.Coupon | null`.
    // By default the list endpoint returns just the coupon ID string, so
    // we have to ask Stripe to expand it — otherwise the admin page can't
    // see amount_off / percent_off / applies_to. (The earlier version of
    // this code read `promo.promotion?.coupon` *without* expansion, so
    // `coupon` was always a string and `typeof c !== "string"` filtered it
    // to null. testerCouponOff therefore lied even when the promo was fine.)
    const promos = await stripe.promotionCodes.list({
      code: "TESTER",
      active: true,
      limit: 1,
      expand: ["data.promotion.coupon"],
    });
    const promo = promos.data[0];
    if (promo) {
      report.stripe.testerPromoActive = promo.active;
      report.stripe.testerPromoCode = promo.code;
      const couponField = promo.promotion?.coupon;
      const coupon =
        couponField && typeof couponField !== "string" ? couponField : null;
      if (coupon) {
        report.stripe.testerCouponId = coupon.id;
        report.stripe.testerCouponValid = coupon.valid;
        report.stripe.testerCouponAmountOff = coupon.amount_off ?? null;
        report.stripe.testerCouponPercentOff = coupon.percent_off ?? null;
        report.stripe.testerCouponDuration = coupon.duration ?? null;
        report.stripe.testerCouponAppliesToProducts =
          coupon.applies_to?.products ?? null;
      }
    }
  } catch (err) {
    report.stripe.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(report);
}
