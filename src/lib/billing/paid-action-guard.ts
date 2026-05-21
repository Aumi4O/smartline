import { headers } from "next/headers";
import {
  createActivationCheckout,
  createCreditCheckout,
  getOrCreateStripeCustomer,
} from "@/lib/billing/stripe-service";
import { ACTIVATION_AMOUNT_CENTS } from "@/lib/pricing";

interface PaidActionCheckoutInput {
  org: {
    id: string;
    name: string;
    planStatus: string;
    stripeCustomerId?: string | null;
  };
  email: string;
  reason: string;
}

export async function createPaidActionCheckout({
  org,
  email,
  reason,
}: PaidActionCheckoutInput): Promise<string> {
  const origin =
    (await headers()).get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://smartlineagent.com";
  const customerId =
    org.stripeCustomerId ||
    (await getOrCreateStripeCustomer(org.id, email, org.name));

  if (org.planStatus === "inactive") {
    const checkout = await createActivationCheckout(
      org.id,
      customerId,
      `${origin}/dashboard?activated=1`,
      `${origin}/billing?trial=cancelled&reason=${encodeURIComponent(reason)}`
    );
    return checkout.url ?? `${origin}/billing?err=checkout_no_url`;
  }

  const checkout = await createCreditCheckout(
    org.id,
    customerId,
    ACTIVATION_AMOUNT_CENTS,
    `${origin}/billing?credits=added`,
    `${origin}/billing?credits=cancelled&reason=${encodeURIComponent(reason)}`
  );
  return checkout.url ?? `${origin}/billing?err=checkout_no_url`;
}

export function paidActionRequiredResponse(checkoutUrl: string, message: string) {
  return Response.json(
    {
      error: "Payment required",
      message,
      checkoutUrl,
      requiredAmountCents: ACTIVATION_AMOUNT_CENTS,
      starterPackCents: ACTIVATION_AMOUNT_CENTS,
    },
    { status: 402 }
  );
}
