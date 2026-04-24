#!/usr/bin/env node
// Disables FORCE ROW LEVEL SECURITY on all public tables.
// RLS remains ENABLED (protects against the anon/authenticated Supabase API),
// but the table owner (our `postgres` superuser via DATABASE_URL) can now
// read/write without matching a policy.
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const TABLES = [
  "organizations", "users", "accounts", "sessions", "verification_tokens",
  "org_memberships", "business_profiles", "agents", "agent_versions",
  "phone_numbers", "knowledge_documents", "knowledge_chunks",
  "conversations", "messages", "credit_balances", "credit_transactions",
  "campaigns", "leads", "consent_records", "audit_logs", "webhook_endpoints",
];

try {
  for (const table of TABLES) {
    await sql.unsafe(`ALTER TABLE public.${table} NO FORCE ROW LEVEL SECURITY;`);
  }

  const rows = await sql`
    SELECT c.relname AS tablename,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `;
  console.table(rows);

  const bad = rows.filter((r) => r.rls_forced);
  if (bad.length === 0) {
    console.log(`\n✅ All ${rows.length} tables: RLS enabled, FORCE disabled.`);
    console.log("   Superuser can now write via Drizzle. Anon still blocked.");
  } else {
    console.log(`\n⚠️  ${bad.length} tables still have FORCE enabled:`);
    bad.forEach((t) => console.log(`   - ${t.tablename}`));
  }
} finally {
  await sql.end();
}
