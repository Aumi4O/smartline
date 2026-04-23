#!/usr/bin/env node
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

try {
  const rows = await sql`
    SELECT
      c.relname AS tablename,
      c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `;
  console.table(rows);

  const unsecured = rows.filter((r) => !r.rls_enabled || !r.rls_forced);
  if (unsecured.length === 0) {
    console.log(`\n✅ All ${rows.length} tables have RLS enabled AND forced.`);
  } else {
    console.log(`\n⚠️  ${unsecured.length} tables are NOT fully secured:`);
    unsecured.forEach((t) => console.log(`  - ${t.tablename}`));
  }
} finally {
  await sql.end();
}
