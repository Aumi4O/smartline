import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getBusinessProfile, saveBusinessProfile, buildKnowledgeText } from "@/lib/knowledge/business-profile";
import { createDocument, listDocuments, deleteDocument } from "@/lib/knowledge/knowledge-service";
import { listAgents } from "@/lib/agents/agent-service";

export async function GET() {
  try {
    const { org } = await requireOrg();
    const profile = await getBusinessProfile(org.id);

    return NextResponse.json({ profile: profile || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { org } = await requireOrg();
    const body = await req.json();

    const profile = await saveBusinessProfile(org.id, body);

    const knowledgeText = buildKnowledgeText(body);
    if (knowledgeText.trim()) {
      const agents = await listAgents(org.id);

      for (const agent of agents) {
        const existingDocs = await listDocuments(agent.id);
        const businessDoc = existingDocs.find((d) => d.filename === "_business_profile.txt");
        if (businessDoc) {
          await deleteDocument(businessDoc.id, org.id);
        }

        await createDocument(
          org.id,
          agent.id,
          "_business_profile.txt",
          "text/plain",
          knowledgeText
        );
      }
    }

    return NextResponse.json({ profile, synced: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
