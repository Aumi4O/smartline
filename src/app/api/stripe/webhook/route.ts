import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { activateSubscription, cancelSubscription } from "@/lib/billing/stripe-service";
import { addCredits } from "@/lib/billing/credits";
import { activateOrg } from "@/lib/org";
import { provisionOrg } from "@/lib/provisioning/orchestrator";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      const type = session.metadata?.type;

      if (!orgId) break;

      if (type === "activation" || type === "activation_trial") {
        const amountCents = parseInt(session.metadata?.amountCents || "500", 10);
        await addCredits(
          orgId,
          amountCents,
          "Activation — $5.00 usage credits",
          "purchase",
          { stripeSessionId: session.id }
        );
        await activateOrg(orgId);
        provisionOrg(orgId).catch((err) =>
          console.error(`Background provisioning failed for ${orgId}:`, err)
        );
        if (type === "activation_trial" && session.subscription) {
          await activateSubscription(orgId, session.subscription as string);
        }
      }

      if (type === "subscription" && session.subscription) {
        await activateSubscription(orgId, session.subscription as string);
      }

      if (type === "credits") {
        const amountCents = parseInt(session.metadata?.amountCents || "0", 10);
        if (amountCents > 0) {
          await addCredits(
            orgId,
            amountCents,
            `Credit purchase — $${(amountCents / 100).toFixed(2)}`,
            "purchase",
            { stripeSessionId: session.id }
          );
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (!orgId) break;

      const status = sub.status;
      // Keep Pro while Stripe still considers the subscription "live" (incl. dunning).
      const proStatuses = new Set(["active", "trialing", "past_due"]);
      // Ended or will not pay — mirror customer.subscription.deleted
      const endedStatuses = new Set(["canceled", "unpaid", "incomplete_expired"]);

      if (proStatuses.has(status)) {
        await activateSubscription(orgId, sub.id);
      } else if (endedStatuses.has(status)) {
        await cancelSubscription(orgId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (orgId) await cancelSubscription(orgId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription_details?: { metadata?: Record<string, string> | null } | null;
      };
      const orgId =
        invoice.subscription_details?.metadata?.orgId ??
        (invoice.metadata as Record<string, string> | null | undefined)?.orgId;
      if (orgId) {
        console.warn(`Payment failed for org ${orgId}, invoice ${invoice.id}`);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
