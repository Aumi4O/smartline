import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { listOrgDocuments } from "@/lib/knowledge/knowledge-service";

export async function GET() {
  try {
    const { org } = await requireOrg();
    const documents = await listOrgDocuments(org.id);

    return NextResponse.json({
      documents: documents.map((d) => ({
        id: d.id,
        agentId: d.agentId,
        filename: d.filename,
        mimeType: d.mimeType,
        fileSizeBytes: d.fileSizeBytes,
        status: d.status,
        chunkCount: d.chunkCount,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
