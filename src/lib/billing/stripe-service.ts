import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PLANS, ACTIVATION_AMOUNT_CENTS } from "@/lib/pricing";

export async function getOrCreateStripeCustomer(
  orgId: string,
  email: string,
  orgName: string
) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (org?.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name: orgName,
    metadata: { orgId },
  });

  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizations.id, orgId));

  return customer.id;
}

export async function createActivationCheckout(
  orgId: string,
  customerId: string,
  successUrl: string,
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "SmartLine Activation",
            description: "$5.00 deposit — converts to usage credits instantly",
          },
          unit_amount: ACTIVATION_AMOUNT_CENTS,
        },
        quantity: 1,
      },
    ],
    metadata: { orgId, type: "activation", amountCents: String(ACTIVATION_AMOUNT_CENTS) },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

export async function createSubscriptionCheckout(
  orgId: string,
  customerId: string,
  successUrl: string,
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: PLANS.pro.name,
            description: "AI voice agents platform — 3 agents, 5GB storage, priority support",
          },
          recurring: { interval: "month" },
          unit_amount: PLANS.pro.monthlyPriceCents,
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: { orgId },
    },
    metadata: { orgId, type: "subscription" },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

export async function createCreditCheckout(
  orgId: string,
  customerId: string,
  amountCents: number,
  successUrl: string,
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "SmartLine Credits",
            description: `$${(amountCents / 100).toFixed(2)} in usage credits`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: { orgId, type: "credits", amountCents: String(amountCents) },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

export async function activateSubscription(orgId: string, subscriptionId: string) {
  await db
    .update(organizations)
    .set({
      stripeSubscriptionId: subscriptionId,
      plan: "pro",
      planStatus: "pro",
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}

export async function cancelSubscription(orgId: string) {
  await db
    .update(organizations)
    .set({
      plan: "starter",
      planStatus: "active",
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}
