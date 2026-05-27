import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  PLAN_TRIAL_CREDIT_CENTS,
  PRO_TRIAL_DAYS,
  type SubscriptionTierKey,
  getSubscriptionTier,
} from "@/lib/pricing";

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

/**
 * Selected monthly tier with a 7-day trial. The webhook grants a small
 * usage-credit bonus after Checkout completes so paid-plan customers can test
 * calls before buying a separate credit pack.
 */
export async function createActivationCheckout(
  orgId: string,
  customerId: string,
  successUrl: string,
  cancelUrl: string,
  tierKey: SubscriptionTierKey = "growth"
) {
  const tier = getSubscriptionTier(tierKey);
  const tierLineItem = subscriptionTierLineItem(tierKey);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_collection: "always",
    allow_promotion_codes: true,
    line_items: [tierLineItem],
    subscription_data: {
      trial_period_days: PRO_TRIAL_DAYS,
      metadata: { orgId, tier: tier.key },
    },
    metadata: {
      orgId,
      type: "activation_trial",
      tier: tier.key,
      amountCents: String(PLAN_TRIAL_CREDIT_CENTS),
      creditType: "bonus",
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

export async function createSubscriptionCheckout(
  orgId: string,
  customerId: string,
  successUrl: string,
  cancelUrl: string,
  tierKey: SubscriptionTierKey = "growth"
) {
  const tier = getSubscriptionTier(tierKey);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_collection: "always",
    allow_promotion_codes: true,
    line_items: [subscriptionTierLineItem(tierKey)],
    subscription_data: {
      metadata: { orgId, tier: tier.key },
    },
    metadata: { orgId, type: "subscription", tier: tier.key },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

export function subscriptionTierLineItem(tierKey: SubscriptionTierKey) {
  const tier = getSubscriptionTier(tierKey);
  const configuredPriceId = process.env[tier.stripePriceEnv];

  if (configuredPriceId) {
    return { price: configuredPriceId, quantity: 1 };
  }

  return {
    price_data: {
      currency: "usd",
      product_data: {
        name: tier.name,
        description: `${tier.description} Includes ${tier.includedMinutes.toLocaleString()} minutes/month, ${tier.includedAgents} agent${tier.includedAgents === 1 ? "" : "s"}, and ${tier.includedPhoneNumbers} phone number${tier.includedPhoneNumbers === 1 ? "" : "s"}.`,
      },
      recurring: { interval: "month" as const },
      unit_amount: tier.monthlyPriceCents,
    },
    quantity: 1,
  };
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
  return activateSubscriptionTier(orgId, subscriptionId, "growth");
}

export async function activateSubscriptionTier(
  orgId: string,
  subscriptionId: string,
  tierKey: SubscriptionTierKey | string = "growth"
) {
  const tier = getSubscriptionTier(tierKey);
  await db
    .update(organizations)
    .set({
      stripeSubscriptionId: subscriptionId,
      plan: tier.key,
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
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}
