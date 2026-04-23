import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getOrCreateStripeCustomer, createSubscriptionCheckout } from "@/lib/billing/stripe-service";

export async function POST(req: NextRequest) {
  try {
    const { session, org } = await requireOrg();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const customerId = await getOrCreateStripeCustomer(
      org.id,
      session.user!.email!,
      org.name
    );

    const checkout = await createSubscriptionCheckout(
      org.id,
      customerId,
      `${appUrl}/billing?success=1`,
      `${appUrl}/billing?cancelled=1`
    );

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
