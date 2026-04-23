import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getAgent, updateAgent, deleteAgent, getAgentVersions } from "@/lib/agents/agent-service";
import { logAuditEvent } from "@/lib/compliance/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await requireOrg();
    const agent = await getAgent(id, org.id);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const versions = await getAgentVersions(id);

    return NextResponse.json({ agent, versions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, org } = await requireOrg();
    const body = await req.json();

    const agent = await updateAgent(id, org.id, session.user!.id!, body);

    logAuditEvent(org.id, "agent.updated", "agent", id, session.user!.id!).catch(() => {});

    return NextResponse.json({ agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await requireOrg();

    await deleteAgent(id, org.id);

    logAuditEvent(org.id, "agent.deleted", "agent", id).catch(() => {});

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
