import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getOrCreateStripeCustomer, createActivationCheckout } from "@/lib/billing/stripe-service";
import { logAuditEvent } from "@/lib/compliance/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST() {
  try {
    const { session, org } = await requireOrg();

    const rl = await rateLimit(org.id, "billing");
    if (!rl.success) return rateLimitResponse(rl.reset);

    if (org.planStatus !== "inactive") {
      return NextResponse.json({ error: "Account already activated" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const customerId = await getOrCreateStripeCustomer(
      org.id,
      session.user!.email!,
      org.name
    );

    const checkout = await createActivationCheckout(
      org.id,
      customerId,
      `${appUrl}/dashboard?activated=1`,
      `${appUrl}/billing`
    );

    logAuditEvent(org.id, "billing.activation_started", "organization", org.id, session.user!.id!).catch(() => {});

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
