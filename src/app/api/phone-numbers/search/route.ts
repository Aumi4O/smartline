import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { searchAvailableNumbers } from "@/lib/provisioning/twilio-provisioning";
import { isActivated } from "@/lib/pricing";

export async function GET(req: NextRequest) {
  try {
    const { org } = await requireOrg();

    if (!isActivated(org.planStatus)) {
      return NextResponse.json({ error: "Account not activated" }, { status: 403 });
    }

    const areaCode = req.nextUrl.searchParams.get("areaCode") || undefined;
    const numbers = await searchAvailableNumbers(areaCode);

    return NextResponse.json({ numbers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
