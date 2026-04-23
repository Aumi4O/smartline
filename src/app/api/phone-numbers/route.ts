import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { listOrgPhoneNumbers } from "@/lib/provisioning/twilio-provisioning";

export async function GET() {
  try {
    const { org } = await requireOrg();
    const numbers = await listOrgPhoneNumbers(org.id);

    return NextResponse.json({
      numbers: numbers.map((n) => ({
        id: n.id,
        phoneNumber: n.phoneNumber,
        agentId: n.agentId,
        status: n.status,
        monthlyCostCents: n.monthlyCostCents,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
