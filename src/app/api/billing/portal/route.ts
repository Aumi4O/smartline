import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { createPortalSession } from "@/lib/billing/stripe-service";

export async function POST() {
  try {
    const { org } = await requireOrg();

    if (!org.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const session = await createPortalSession(org.stripeCustomerId, `${appUrl}/billing`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
