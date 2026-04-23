-- ============================================================
-- SmartLine: Enable Row Level Security on all tables
-- ============================================================
-- Our app connects to Postgres directly via Drizzle ORM using
-- the DATABASE_URL (service-role connection), which BYPASSES RLS.
-- All public API traffic (via PostgREST / supabase-js) goes
-- through anon/authenticated roles and WILL be blocked by RLS.
--
-- Outcome:
--   - Attackers using your anon key cannot read/write any table.
--   - Your Next.js server (Drizzle) continues to work normally.
--
-- Safe to run multiple times.
-- ============================================================

-- Enable RLS on all application tables
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints    ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (defense in depth)
ALTER TABLE public.organizations        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.accounts             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sessions             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agents               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversations        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.leads                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints    FORCE ROW LEVEL SECURITY;

-- Revoke ALL public-role grants (anon + authenticated can't even SELECT via PostgREST)
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Sanity check: list all tables and their RLS status
SELECT
  n.nspname AS schemaname,
  c.relname AS tablename,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
