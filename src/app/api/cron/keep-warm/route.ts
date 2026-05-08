import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Touch the database so Supabase's free-tier inactivity timer resets.
// Vercel Cron hits this on a schedule defined in vercel.json.
//
// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically when
// CRON_SECRET is set as an environment variable. We verify it so the route
// can't be abused as an open DB-pinger.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const start = Date.now();
  try {
    const rows = await db.execute(sql`select 1 as ok`);
    return NextResponse.json({
      ok: true,
      rows: rows.length,
      ms: Date.now() - start,
      at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message, ms: Date.now() - start },
      { status: 500 }
    );
  }
}
