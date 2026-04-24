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
 *   - STRIPE_PRO_PRICE_ID present and resolves at Stripe
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
      STRIPE_PRO_PRICE_ID: !!process.env.STRIPE_PRO_PRICE_ID,
      STRIPE_PRO_PRODUCT_ID: !!process.env.STRIPE_PRO_PRODUCT_ID,
      OPENAI_WEBHOOK_SECRET: !!process.env.OPENAI_WEBHOOK_SECRET,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      OPENAI_SIP_PROJECT_ID: !!process.env.OPENAI_SIP_PROJECT_ID,
      OPENAI_ADMIN_KEY: !!process.env.OPENAI_ADMIN_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || null,
    },
    stripe: {
      priceId: process.env.STRIPE_PRO_PRICE_ID || null,
      priceResolved: false as boolean,
      priceActive: false as boolean,
      priceAmount: null as number | null,
      priceCurrency: null as string | null,
      priceRecurring: null as string | null,
      testerPromoActive: false as boolean,
      testerCouponOff: null as number | null,
      error: null as string | null,
    },
  };

  try {
    if (process.env.STRIPE_PRO_PRICE_ID) {
      const price = await stripe.prices.retrieve(process.env.STRIPE_PRO_PRICE_ID);
      report.stripe.priceResolved = true;
      report.stripe.priceActive = price.active;
      report.stripe.priceAmount = price.unit_amount;
      report.stripe.priceCurrency = price.currency;
      report.stripe.priceRecurring = price.recurring?.interval || null;
    }

    const promos = await stripe.promotionCodes.list({ code: "TESTER", limit: 1 });
    const promo = promos.data[0];
    if (promo) {
      report.stripe.testerPromoActive = promo.active;
      const c = promo.promotion?.coupon;
      const coupon = c && typeof c !== "string" ? c : null;
      report.stripe.testerCouponOff = coupon?.amount_off ?? null;
    }
  } catch (err) {
    report.stripe.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(report);
}
