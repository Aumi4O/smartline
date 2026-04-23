import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { createDocument } from "@/lib/knowledge/knowledge-service";
import { listAgents } from "@/lib/agents/agent-service";
import { isActivated } from "@/lib/pricing";

const ALLOWED_TYPES = [
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const { org } = await requireOrg();

    if (!isActivated(org.planStatus)) {
      return NextResponse.json({ error: "Account not activated" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const agentId = formData.get("agentId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!agentId) {
      return NextResponse.json({ error: "agentId required" }, { status: 400 });
    }

    const agents = await listAgents(org.id);
    const agentExists = agents.some((a) => a.id === agentId);
    if (!agentExists) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith(".txt") && !file.name.endsWith(".csv") && !file.name.endsWith(".json") && !file.name.endsWith(".md")) {
      return NextResponse.json(
        { error: "Unsupported file type. Supported: TXT, CSV, JSON, MD" },
        { status: 400 }
      );
    }

    const content = await file.text();

    if (!content.trim()) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const result = await createDocument(
      org.id,
      agentId,
      file.name,
      file.type || "text/plain",
      content
    );

    return NextResponse.json({
      document: {
        id: result.document.id,
        filename: result.document.filename,
        chunkCount: result.chunkCount,
        status: "ready",
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
