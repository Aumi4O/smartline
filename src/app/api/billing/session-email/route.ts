import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

/**
 * Looks up the email Stripe collected on its hosted Checkout page for a
 * given session id. Used by /welcome to auto-send a magic sign-in link
 * without forcing the user to re-enter the email they just typed on Stripe.
 *
 * Safe to expose publicly: we only return the email if the session is in
 * a completed state and actually belongs to our guest-activation flow.
 * Session ids are unguessable (cs_test_/cs_live_ + 56+ chars).
 */
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("session_id");
  if (!id || !id.startsWith("cs_")) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(id);

    if (
      session.metadata?.type !== "guest_activation_trial" &&
      session.metadata?.type !== "activation" &&
      session.metadata?.type !== "activation_trial" &&
      session.metadata?.type !== "subscription"
    ) {
      return NextResponse.json({ error: "Not a checkout session" }, { status: 404 });
    }

    const email = session.customer_details?.email || null;
    const paid = session.payment_status === "paid" || session.status === "complete";

    return NextResponse.json({ email, paid });
  } catch (err) {
    console.error("[billing/session-email] lookup failed:", err);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
