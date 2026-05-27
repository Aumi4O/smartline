import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  PLAN_TRIAL_CREDIT_CENTS,
  PRO_TRIAL_DAYS,
  getSubscriptionTier,
} from "@/lib/pricing";
import { requireOrg } from "@/lib/org";
import {
  createSubscriptionCheckout,
  getOrCreateStripeCustomer,
  subscriptionTierLineItem,
} from "@/lib/billing/stripe-service";

/**
 * Stripe Checkout for the public monthly plan path.
 *
 * - Creates a subscription Checkout for Starter/Growth/Scale with a 7-day trial.
 * - No credit pack is charged at signup. The webhook grants a small usage-credit
 *   bonus so paid-plan customers can test calls before buying more credits.
 * - Promotion codes are enabled.
 * - On success we land on /welcome?session_id={ID} which fetches the email
 *   from Stripe and auto-sends a magic sign-in link.
 *
 * The webhook (/api/stripe/webhook) listens for
 * `checkout.session.completed` with `metadata.type === "guest_activation_trial"`
 * and creates the user+org from `customer_details.email`.
 *
 * GET is the guest homepage path. POST is the signed-in upgrade path and
 * returns JSON so dashboard fetch callers do not accidentally parse Stripe
 * HTML after a redirect.
 */
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  try {
    const { session, org } = await requireOrg();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const url = new URL(req.url);
    const tier = getSubscriptionTier(url.searchParams.get("tier"));
    const customerId = await getOrCreateStripeCustomer(
      org.id,
      session.user!.email!,
      org.name
    );
    const checkout = await createSubscriptionCheckout(
      org.id,
      customerId,
      `${appUrl}/dashboard?upgraded=1`,
      `${appUrl}/billing`,
      tier.key
    );

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const promoCode = url.searchParams.get("promo")?.trim().toUpperCase() || "";
  const tier = getSubscriptionTier(url.searchParams.get("tier"));

  try {
    // If a promo code was passed on the URL, look it up on Stripe and
    // pre-apply it. Falls back silently to "allow promotion codes" if the
    // code doesn't match so users can still type one into the Stripe page.
    let preAppliedPromotionId: string | undefined;
    if (promoCode) {
      try {
        const list = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        });
        if (list.data[0]?.id) preAppliedPromotionId = list.data[0].id;
      } catch (err) {
        console.warn("[billing/checkout] promo lookup failed:", err);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_collection: "always",
      // Only one of these can be set at a time. If we pre-applied a promo,
      // Stripe locks it in; otherwise we let the user type any code.
      ...(preAppliedPromotionId
        ? { discounts: [{ promotion_code: preAppliedPromotionId }] }
        : { allow_promotion_codes: true }),
      // Note: subscription mode automatically creates the customer from
      // the email Stripe collects. Passing `customer_creation` here is
      // an error (`can only be used in payment mode`).
      billing_address_collection: "auto",
      line_items: [subscriptionTierLineItem(tier.key)],
      subscription_data: {
        trial_period_days: PRO_TRIAL_DAYS,
        metadata: { source: "guest_checkout", tier: tier.key },
      },
      metadata: {
        type: "guest_activation_trial",
        tier: tier.key,
        amountCents: String(PLAN_TRIAL_CREDIT_CENTS),
        creditType: "bonus",
        ...(promoCode ? { promoCode } : {}),
      },
      success_url: `${appUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe didn't return a checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("[billing/checkout] failed:", err);
    const msg = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.redirect(
      `${appUrl}/?checkout=error&reason=${encodeURIComponent(msg)}`,
      303
    );
  }
}
