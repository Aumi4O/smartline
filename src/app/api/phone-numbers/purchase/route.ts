import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import {
  purchasePhoneNumber,
  listOrgPhoneNumbers,
  searchAvailableNumbers,
} from "@/lib/provisioning/twilio-provisioning";
import { provisionOrg } from "@/lib/provisioning/orchestrator";
import { deductCredits } from "@/lib/billing/credits";
import { isActivated, isPro, PAYG_LIMITS, PRO_LIMITS, USAGE_RATES } from "@/lib/pricing";
import { logAuditEvent } from "@/lib/compliance/audit";
import { db } from "@/lib/db";
import { agents, organizations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { org } = await requireOrg();

    if (!isActivated(org.planStatus)) {
      return NextResponse.json({ error: "Account not activated" }, { status: 403 });
    }

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
      return NextResponse.json(
        { error: "Insufficient credits. Add more credits first." },
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
