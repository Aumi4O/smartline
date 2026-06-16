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
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname;
  `;
  const grants = await sql`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee, privilege_type;
  `;
  const functionGrants = await sql`
    SELECT p.proname AS function_name, r.rolname AS grantee
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON has_function_privilege(r.oid, p.oid, 'EXECUTE')
    WHERE n.nspname = 'public'
      AND r.rolname IN ('anon', 'authenticated')
    ORDER BY p.proname, r.rolname;
  `;

  console.table(rows);

  const unsecured = rows.filter((r) => !r.rls_enabled || !r.rls_forced);
  if (
    unsecured.length === 0 &&
    grants.length === 0 &&
    functionGrants.length === 0
  ) {
    console.log(
      `\n✅ All ${rows.length} public tables have RLS enabled/forced and no anon/authenticated grants.`
    );
  } else {
    if (unsecured.length > 0) {
      console.log(`\n⚠️  ${unsecured.length} tables are NOT fully secured:`);
      unsecured.forEach((t) => console.log(`  - ${t.tablename}`));
    }
    if (grants.length > 0) {
      console.log(`\n⚠️  ${grants.length} anon/authenticated table grants remain:`);
      console.table(grants);
    }
    if (functionGrants.length > 0) {
      console.log(
        `\n⚠️  ${functionGrants.length} anon/authenticated function grants remain:`
      );
      console.table(functionGrants);
    }
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
