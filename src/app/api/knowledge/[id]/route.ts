import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { deleteDocument } from "@/lib/knowledge/knowledge-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await requireOrg();

    await deleteDocument(id, org.id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
