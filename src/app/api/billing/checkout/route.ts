import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { PLANS, ACTIVATION_AMOUNT_CENTS, PRO_TRIAL_DAYS } from "@/lib/pricing";

/**
 * One-click Stripe Checkout for brand-new visitors.
 *
 * - No login, no email form on our side.
 * - Stripe's hosted page collects the email and the card.
 * - Creates a subscription Checkout: $199/mo Pro (with a 3-day trial) + a
 *   one-time $5 activation line. That matches our headline offer:
 *     "$5 today → 3 days full access → $199/mo auto-starts on day 4"
 * - Promotion codes are enabled so the TESTER code works ($150 off the
 *   first month — does not discount the $5 activation).
 * - On success we land on /welcome?session_id={ID} which fetches the email
 *   from Stripe and auto-sends a magic sign-in link.
 *
 * The webhook (/api/stripe/webhook) listens for
 * `checkout.session.completed` with `metadata.type === "guest_activation_trial"`
 * and creates the user+org from `customer_details.email`.
 *
 * GET and POST both work so the same route can be a plain <a href="..."> or
 * a fetch().
 */
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const promoCode = url.searchParams.get("promo")?.trim().toUpperCase() || "";

  const proLineItem = proPriceId
    ? { price: proPriceId, quantity: 1 }
    : {
        price_data: {
          currency: "usd",
          product_data: {
            name: PLANS.pro.name,
            description: `Full Pro access. $199/mo after a ${PRO_TRIAL_DAYS}-day trial — cancel before then to avoid subscription billing.`,
          },
          recurring: { interval: "month" as const },
          unit_amount: PLANS.pro.monthlyPriceCents,
        },
        quantity: 1,
      };

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
      // Only one of these can be set at a time. If we pre-applied a promo,
      // Stripe locks it in; otherwise we let the user type any code.
      ...(preAppliedPromotionId
        ? { discounts: [{ promotion_code: preAppliedPromotionId }] }
        : { allow_promotion_codes: true }),
      // Note: subscription mode automatically creates the customer from
      // the email Stripe collects. Passing `customer_creation` here is
      // an error (`can only be used in payment mode`).
      billing_address_collection: "auto",
      line_items: [
        proLineItem,
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Activation — $5 usage credits",
              description:
                "One-time today. Credited to your account balance when you land on the dashboard.",
            },
            unit_amount: ACTIVATION_AMOUNT_CENTS,
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: PRO_TRIAL_DAYS,
        metadata: { source: "guest_checkout" },
      },
      metadata: {
        type: "guest_activation_trial",
        amountCents: String(ACTIVATION_AMOUNT_CENTS),
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
