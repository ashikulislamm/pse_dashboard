-- 007_security_hardening.sql
-- 1. Hide credential hashes from user-scoped (RLS) queries
-- 2. Login attempt tracking for brute-force protection
-- Safe to re-run.

-- Column-level privileges: app-role queries (role `authenticated`) can read every profile
-- column EXCEPT password_hash. Login and session checks use the owner connection, which is unaffected.
REVOKE SELECT ON profiles FROM authenticated;
GRANT SELECT (id, email, full_name, role, team_id, is_pse, is_active, created_at, updated_at)
  ON profiles TO authenticated;

-- Failed login attempts (queried only by the server over the owner connection)
CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_at ON login_attempts (email, attempted_at DESC);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON login_attempts FROM authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON login_attempts FROM anon;
  END IF;
END $$;
