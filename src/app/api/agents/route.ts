import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { createAgent, listAgents } from "@/lib/agents/agent-service";
import { getBusinessProfile, buildSystemPrompt } from "@/lib/knowledge/business-profile";
import { createDocument } from "@/lib/knowledge/knowledge-service";
import { buildKnowledgeText } from "@/lib/knowledge/business-profile";
import { isActivated, isPro, PAYG_LIMITS, PRO_LIMITS } from "@/lib/pricing";
import { logAuditEvent } from "@/lib/compliance/audit";

export async function GET() {
  try {
    const { org } = await requireOrg();
    const agentList = await listAgents(org.id);

    return NextResponse.json({ agents: agentList });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, org } = await requireOrg();

    if (!isActivated(org.planStatus)) {
      return NextResponse.json({ error: "Account not activated" }, { status: 403 });
    }

    const existing = await listAgents(org.id);
    const limit = isPro(org.plan) ? PRO_LIMITS.maxAgents : PAYG_LIMITS.maxAgents;

    if (existing.length >= limit) {
      return NextResponse.json(
        { error: `Agent limit reached (${limit}). ${isPro(org.plan) ? "" : "Upgrade to Pro for more."}` },
        { status: 403 }
      );
    }

    const body = await req.json();

    if (!body.systemPrompt) {
      const profile = await getBusinessProfile(org.id);
      if (profile) {
        body.systemPrompt = buildSystemPrompt(profile as Parameters<typeof buildSystemPrompt>[0]);
      }
    }

    const agent = await createAgent(org.id, session.user!.id!, body);

    logAuditEvent(org.id, "agent.created", "agent", agent.id, session.user!.id!, undefined, { name: body.name }).catch(() => {});

    const profile = await getBusinessProfile(org.id);
    if (profile) {
      const knowledgeText = buildKnowledgeText(profile as Parameters<typeof buildKnowledgeText>[0]);
      if (knowledgeText.trim()) {
        await createDocument(org.id, agent.id, "_business_profile.txt", "text/plain", knowledgeText);
      }
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
