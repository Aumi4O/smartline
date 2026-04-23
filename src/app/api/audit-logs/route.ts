import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { org } = await requireOrg();
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    const logs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.orgId, org.id),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
      limit,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
