import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { releasePhoneNumber } from "@/lib/provisioning/twilio-provisioning";
import { logAuditEvent } from "@/lib/compliance/audit";

export async function POST(req: NextRequest) {
  try {
    const { org } = await requireOrg();
    const { phoneNumberId } = await req.json();

    if (!phoneNumberId) {
      return NextResponse.json({ error: "phoneNumberId required" }, { status: 400 });
    }
    await releasePhoneNumber(phoneNumberId);

    logAuditEvent(org.id, "phone_number.released", "phone_number", phoneNumberId).catch(() => {});

    return NextResponse.json({ released: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
