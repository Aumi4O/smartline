import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getOrCreateStripeCustomer, createCreditCheckout } from "@/lib/billing/stripe-service";
import { CREDIT_PACKS } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  try {
    const { session, org } = await requireOrg();
    const { amountCents } = await req.json();

    const validPack = CREDIT_PACKS.find((p) => p.amountCents === amountCents);
    if (!validPack) {
      return NextResponse.json({ error: "Invalid credit amount" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const customerId = await getOrCreateStripeCustomer(
      org.id,
      session.user!.email!,
      org.name
    );

    const checkout = await createCreditCheckout(
      org.id,
      customerId,
      amountCents,
      `${appUrl}/billing?credits=1`,
      `${appUrl}/billing`
    );

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
