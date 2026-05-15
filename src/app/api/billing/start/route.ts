import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrCreateOrg } from "@/lib/org";
import {
  getOrCreateStripeCustomer,
  createActivationCheckout,
} from "@/lib/billing/stripe-service";
import { logAuditEvent } from "@/lib/compliance/audit";

/**
 * First-credit-pack CTA.
 *
 * - If not signed in           → redirect to /login?next=/api/billing/start
 * - If signed in, planStatus=inactive → create Stripe Checkout Session and 302 to it
 * - If already active          → redirect to /dashboard
 *
 * Used when a signed-in user reaches their first provider-cost action and needs
 * credits before SmartLine spends money on phone/API infrastructure.
 */
export async function GET(req: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.redirect(
      `${appUrl}/login?next=${encodeURIComponent("/api/billing/start")}`
    );
  }

  const org = await getOrCreateOrg(session.user.id, session.user.email);

  if (org.planStatus !== "inactive") {
    return NextResponse.redirect(`${appUrl}/dashboard`);
  }

  try {
    const customerId = await getOrCreateStripeCustomer(
      org.id,
      session.user.email,
      org.name
    );

    const checkout = await createActivationCheckout(
      org.id,
      customerId,
      `${appUrl}/dashboard?activated=1`,
      `${appUrl}/billing`
    );

    logAuditEvent(
      org.id,
      "billing.activation_started",
      "organization",
      org.id,
      session.user.id
    ).catch(() => {});

    if (!checkout.url) {
      return NextResponse.redirect(`${appUrl}/billing?err=checkout_no_url`);
    }

    return NextResponse.redirect(checkout.url, { status: 303 });
  } catch (err) {
    console.error("[billing/start] checkout failed:", err);
    return NextResponse.redirect(`${appUrl}/billing?err=checkout_failed`);
  }
}
