#!/usr/bin/env node
// Probe each AWS pooler region to find which one serves our Supabase project.
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const urlMatch = (process.env.DATABASE_URL || "").match(
  /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@db\.([^.]+)\.supabase\.co:\d+\/(.+)$/
);
if (!urlMatch) {
  console.error("Couldn't parse DATABASE_URL. Expected direct Supabase URL.");
  process.exit(1);
}
const [, , password, projectRef, dbName] = urlMatch;
const regions = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-central-1"];

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const user = `postgres.${projectRef}`;
  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:6543/${dbName}`;
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 5, idle_timeout: 2 });
  try {
    const [row] = await sql`SELECT current_database() AS db, inet_server_addr()::text AS ip`;
    console.log(`✅ ${region}  → connected, db=${row.db}`);
    console.log(`\nCorrect pooler URL:\n  ${url.replace(password, "***")}\n`);
    await sql.end();
    console.log(`DATABASE_URL=${url}`);
    process.exit(0);
  } catch (err) {
    console.log(`❌ ${region}  code=${err.code} msg=${err.message}`);
  } finally {
    try { await sql.end({ timeout: 1 }); } catch {}
  }
}
process.exit(1);
