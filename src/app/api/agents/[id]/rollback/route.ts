import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { rollbackAgent } from "@/lib/agents/agent-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, org } = await requireOrg();
    const { version } = await req.json();

    if (!version || typeof version !== "number") {
      return NextResponse.json({ error: "version (number) required" }, { status: 400 });
    }

    const agent = await rollbackAgent(id, org.id, session.user!.id!, version);

    return NextResponse.json({ agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
