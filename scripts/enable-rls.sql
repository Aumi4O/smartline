-- ============================================================
-- SmartLine: harden public schema access
-- ============================================================
-- Safe to run multiple times.
--
-- The app uses the server-side DATABASE_URL via Drizzle. Public Supabase
-- API roles (`anon`, `authenticated`) should not be able to read/write
-- application tables directly through PostgREST.
--
-- This script intentionally discovers all current public tables instead
-- of relying on a hardcoded list, so newly added tables are covered too.
-- ============================================================

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT format('%I.%I', n.nspname, c.relname) AS qualified_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE 'ALTER TABLE ' || t.qualified_name || ' ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE ' || t.qualified_name || ' FORCE ROW LEVEL SECURITY';
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

SELECT
  n.nspname AS schemaname,
  c.relname AS tablename,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname;
