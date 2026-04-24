import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, organizations, orgMemberships, creditBalances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getOrCreateStripeCustomer,
  createActivationCheckout,
} from "@/lib/billing/stripe-service";
import { logAuditEvent } from "@/lib/compliance/audit";

/**
 * Zero-friction Start-for-$5 endpoint.
 *
 * Accepts `{ email }` from the homepage hero and the pricing cards.
 *
 * - Creates a `users` row if none exists for that email (emailVerified stays
 *   null — the Stripe payment + a later magic link verify them).
 * - Creates an organization + membership if none exists for that user.
 * - Creates a Stripe Activation Checkout Session ($5 now, $199/mo on day 4)
 *   with the email prefilled.
 * - Returns `{ url }` so the client can `window.location = url`.
 *
 * No login required. No extra page. One click + one field → Stripe.
 */
export async function POST(req: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
    const email = emailRaw.toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email to continue" },
        { status: 400 }
      );
    }

    let user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      const [created] = await db
        .insert(users)
        .values({ email, name: email.split("@")[0] })
        .returning();
      user = created;
    }

    let membership = await db.query.orgMemberships.findFirst({
      where: eq(orgMemberships.userId, user.id),
      with: { organization: true },
    });

    let org = membership?.organization;
    if (!org) {
      const slug = email.split("@")[0].replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const name = slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      const [created] = await db
        .insert(organizations)
        .values({
          name,
          slug: `${slug}-${Date.now().toString(36)}`,
          plan: "starter",
          planStatus: "inactive",
        })
        .returning();
      org = created;

      await db.insert(orgMemberships).values({
        userId: user.id,
        orgId: org.id,
        role: "owner",
      });

      await db
        .insert(creditBalances)
        .values({ orgId: org.id, balanceCents: 0 })
        .onConflictDoNothing();
    }

    if (org.planStatus !== "inactive") {
      return NextResponse.json({
        url: `${appUrl}/login?next=/dashboard`,
        already_active: true,
      });
    }

    const customerId = await getOrCreateStripeCustomer(org.id, email, org.name);

    const checkout = await createActivationCheckout(
      org.id,
      customerId,
      `${appUrl}/welcome?activated=1&email=${encodeURIComponent(email)}`,
      `${appUrl}/?checkout=cancelled`
    );

    logAuditEvent(
      org.id,
      "billing.guest_checkout_started",
      "organization",
      org.id,
      user.id,
      undefined,
      { email }
    ).catch(() => {});

    if (!checkout.url) {
      return NextResponse.json(
        { error: "Stripe didn't return a checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("[billing/start-guest] failed:", err);
    const msg = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
