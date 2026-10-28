-- 001_enums_and_config.sql
-- Enums and reference/config tables

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'target_manager', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_type AS ENUM ('individual', 'company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE channel_kind AS ENUM ('email', 'phone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stage_kind AS ENUM ('open', 'won', 'lost', 'junk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contribution_type AS ENUM ('cash', 'in_kind');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE party_type AS ENUM ('individual', 'company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_interval AS ENUM ('one_time', 'monthly', 'quarterly', 'semi_annual', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM ('scheduled', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM (
    'task',
    'email',
    'call',
    'meeting',
    'event',
    'campaign',
    'proposal',
    'visit',
    'servicing',
    'prospect_engagement',
    'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_class AS ENUM ('stewardship', 'prospect_engagement', 'independent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM ('planned', 'in_progress', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL DEFAULT '',
  full_name text NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  is_pse boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS currencies (
  code text PRIMARY KEY,
  name text
);

CREATE TABLE IF NOT EXISTS fx_rates (
  currency text NOT NULL REFERENCES currencies(code) ON DELETE CASCADE,
  rate_to_base numeric(18, 6) NOT NULL CHECK (rate_to_base > 0),
  effective_from date NOT NULL,
  PRIMARY KEY (currency, effective_from)
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  kind stage_kind NOT NULL,
  position int NOT NULL
);

CREATE TABLE IF NOT EXISTS contribution_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS verticals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS category_vertical_map (
  category_id uuid PRIMARY KEY REFERENCES contribution_categories(id) ON DELETE CASCADE,
  vertical_id uuid NOT NULL REFERENCES verticals(id) ON DELETE CASCADE
);
