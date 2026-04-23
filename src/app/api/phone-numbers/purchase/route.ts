import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { purchasePhoneNumber, listOrgPhoneNumbers } from "@/lib/provisioning/twilio-provisioning";
import { deductCredits } from "@/lib/billing/credits";
import { isActivated, isPro, PAYG_LIMITS, PRO_LIMITS, USAGE_RATES } from "@/lib/pricing";
import { logAuditEvent } from "@/lib/compliance/audit";

export async function POST(req: NextRequest) {
  try {
    const { org } = await requireOrg();

    if (!isActivated(org.planStatus)) {
      return NextResponse.json({ error: "Account not activated" }, { status: 403 });
    }

    const { phoneNumber } = await req.json();
    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const existing = await listOrgPhoneNumbers(org.id);
    const activeNumbers = existing.filter((n) => n.status === "active");
    const limit = isPro(org.plan) ? PRO_LIMITS.maxPhoneNumbers : PAYG_LIMITS.maxPhoneNumbers;

    if (activeNumbers.length >= limit) {
      return NextResponse.json(
        { error: `Limit reached: ${limit} phone number(s). Upgrade to Pro for more.` },
        { status: 403 }
      );
    }

    const deduction = await deductCredits(
      org.id,
      USAGE_RATES.phone_number_monthly_cents,
      `Phone number: ${phoneNumber} (first month)`,
      "phone_number",
      { phoneNumber }
    );

    if (!deduction.success) {
      return NextResponse.json(
        { error: "Insufficient credits. Add more credits first." },
        { status: 402 }
      );
    }

    const purchased = await purchasePhoneNumber(org.id, phoneNumber);

    logAuditEvent(org.id, "phone_number.purchased", "phone_number", purchased.id, undefined, undefined, { phoneNumber }).catch(() => {});

    return NextResponse.json({ phoneNumber: purchased });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
