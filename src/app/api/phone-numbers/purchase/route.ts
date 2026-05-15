import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import {
  purchasePhoneNumber,
  listOrgPhoneNumbers,
  searchAvailableNumbers,
} from "@/lib/provisioning/twilio-provisioning";
import { provisionOrg } from "@/lib/provisioning/orchestrator";
import { deductCredits } from "@/lib/billing/credits";
import {
  ACTIVATION_AMOUNT_CENTS,
  isPro,
  PAYG_LIMITS,
  PRO_LIMITS,
  USAGE_RATES,
} from "@/lib/pricing";
import {
  createActivationCheckout,
  createCreditCheckout,
  getOrCreateStripeCustomer,
} from "@/lib/billing/stripe-service";
import { logAuditEvent } from "@/lib/compliance/audit";
import { db } from "@/lib/db";
import { agents, organizations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { session, org } = await requireOrg();

    const body = await req.json().catch(() => ({}));
    const explicitNumber: string | undefined = body.phoneNumber;
    const areaCodeRaw: string | undefined = body.areaCode;
    const agentId: string | undefined = body.agentId;

    const existing = await listOrgPhoneNumbers(org.id);
    const activeNumbers = existing.filter((n) => n.status === "active");
    const limit = isPro(org.plan) ? PRO_LIMITS.maxPhoneNumbers : PAYG_LIMITS.maxPhoneNumbers;

    if (activeNumbers.length >= limit) {
      return NextResponse.json(
        { error: `Limit reached: ${limit} phone number(s). Upgrade to Pro for more.` },
        { status: 403 }
      );
    }

    if (agentId) {
      const agent = await db.query.agents.findFirst({
        where: and(eq(agents.id, agentId), eq(agents.orgId, org.id)),
      });
      if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
    }

    const freshOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, org.id),
    });
    if (!freshOrg?.twilioSubAccountSid) {
      try {
        await provisionOrg(org.id);
      } catch (err) {
        console.error("[phone-numbers] auto-provision failed:", err);
        return NextResponse.json(
          {
            error:
              "Could not set up your Twilio sub-account. Please try again in a moment, or contact support@leadagentsstudio.com.",
          },
          { status: 503 }
        );
      }
    }

    let chosenNumber = explicitNumber?.trim() || "";
    let fallbackUsed = false;

    if (!chosenNumber) {
      const areaCode = areaCodeRaw?.replace(/\D/g, "").slice(0, 3) || undefined;

      let candidates = await searchAvailableNumbers(areaCode, "US", 1);
      if (!candidates.length && areaCode) {
        candidates = await searchAvailableNumbers(undefined, "US", 1);
        fallbackUsed = true;
      }

      if (!candidates.length) {
        return NextResponse.json(
          { error: "No US numbers available from Twilio right now. Try again in a moment." },
          { status: 503 }
        );
      }
      chosenNumber = candidates[0].phoneNumber;
    }

    const deduction = await deductCredits(
      org.id,
      USAGE_RATES.phone_number_monthly_cents,
      `Phone number: ${chosenNumber} (first month)`,
      "phone_number",
      { phoneNumber: chosenNumber }
    );

    if (!deduction.success) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const customerId = await getOrCreateStripeCustomer(
        org.id,
        session.user!.email!,
        org.name
      );
      const checkout =
        org.planStatus === "inactive"
          ? await createActivationCheckout(
              org.id,
              customerId,
              `${appUrl}/phone-numbers?credits=1`,
              `${appUrl}/phone-numbers`
            )
          : await createCreditCheckout(
              org.id,
              customerId,
              ACTIVATION_AMOUNT_CENTS,
              `${appUrl}/phone-numbers?credits=1`,
              `${appUrl}/phone-numbers`
            );

      return NextResponse.json(
        {
          error:
            "A SmartLine phone number costs about $1.89/month. Load the $15 starter credit pack first, then we can register the number.",
          checkoutUrl: checkout.url,
          requiredAmountCents: USAGE_RATES.phone_number_monthly_cents,
          starterPackCents: ACTIVATION_AMOUNT_CENTS,
        },
        { status: 402 }
      );
    }

    const purchased = await purchasePhoneNumber(org.id, chosenNumber, agentId);

    logAuditEvent(
      org.id,
      "phone_number.purchased",
      "phone_number",
      purchased.id,
      undefined,
      undefined,
      { phoneNumber: chosenNumber, agentId, fallbackUsed }
    ).catch(() => {});

    return NextResponse.json({
      phoneNumber: purchased,
      fallbackUsed,
      requestedAreaCode: areaCodeRaw || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
