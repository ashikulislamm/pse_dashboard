-- 006_audit_rls.sql
-- Audit log, identity helpers, and PostgreSQL Row-Level Security (RLS) policies

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  row_id text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  diff jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_row ON audit_log(table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at DESC);

-- Helper: resolves current user UUID from transaction context (`app.current_user_id` or `request.jwt.claim.sub`)
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  );
$$;

-- Helper: true iff the current transaction user is an active PSE member
CREATE OR REPLACE FUNCTION is_pse_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = current_app_user_id()
      AND is_pse = true
      AND is_active = true
  );
$$;

-- Helper: true iff the current transaction user is an active PSE member holding one of the specified roles
CREATE OR REPLACE FUNCTION has_role(r app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = current_app_user_id()
      AND is_pse = true
      AND is_active = true
      AND role = ANY(r)
  );
$$;

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_id text;
  v_diff jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row_id := OLD.id::text;
    v_diff := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_row_id := NEW.id::text;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_row_id := NEW.id::text;
    v_diff := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (table_name, row_id, actor_id, action, diff)
  VALUES (TG_TABLE_NAME, v_row_id, current_app_user_id(), TG_OP, v_diff);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_contacts ON contacts;
CREATE TRIGGER trg_audit_contacts
AFTER INSERT OR UPDATE OR DELETE ON contacts
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_pipelines ON pipelines;
CREATE TRIGGER trg_audit_pipelines
AFTER INSERT OR UPDATE OR DELETE ON pipelines
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_receipts ON pipeline_receipts;
CREATE TRIGGER trg_audit_receipts
AFTER INSERT OR UPDATE OR DELETE ON pipeline_receipts
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_target_plans ON target_plans;
CREATE TRIGGER trg_audit_target_plans
AFTER INSERT OR UPDATE OR DELETE ON target_plans
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Ensure role `authenticated` exists and has privileges on public schema tables so
-- `SET LOCAL ROLE authenticated` inside `withUserTransaction` enforces RLS strictly.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable and force RLS across all business and reference tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_vertical_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_quarters ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Reference tables: all PSE members can read; only admin can write
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'teams',
    'settings',
    'currencies',
    'fx_rates',
    'pipeline_stages',
    'contribution_categories',
    'verticals',
    'category_vertical_map'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON %I FOR SELECT USING (is_pse_member())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_write ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_admin_write ON %I FOR ALL USING (has_role(ARRAY[''admin'']::app_role[])) WITH CHECK (has_role(ARRAY[''admin'']::app_role[]))',
      t, t
    );
  END LOOP;
END $$;

-- Profiles: PSE members can read all PSE profiles; admin can manage profiles
DROP POLICY IF EXISTS profiles_read ON profiles;
CREATE POLICY profiles_read ON profiles
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS profiles_admin_write ON profiles;
CREATE POLICY profiles_admin_write ON profiles
FOR ALL
USING (has_role(ARRAY['admin']::app_role[]))
WITH CHECK (has_role(ARRAY['admin']::app_role[]));

-- Contacts: PSE members read and insert; owner or admin updates/deletes
DROP POLICY IF EXISTS contacts_read ON contacts;
CREATE POLICY contacts_read ON contacts
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS contacts_insert ON contacts;
CREATE POLICY contacts_insert ON contacts
FOR INSERT WITH CHECK (is_pse_member());

DROP POLICY IF EXISTS contacts_update ON contacts;
CREATE POLICY contacts_update ON contacts
FOR UPDATE
USING (is_pse_member() AND (owner_id = current_app_user_id() OR has_role(ARRAY['admin']::app_role[])))
WITH CHECK (is_pse_member() AND (owner_id = current_app_user_id() OR has_role(ARRAY['admin']::app_role[])));

DROP POLICY IF EXISTS contacts_delete ON contacts;
CREATE POLICY contacts_delete ON contacts
FOR DELETE
USING (is_pse_member() AND (owner_id = current_app_user_id() OR has_role(ARRAY['admin']::app_role[])));

-- Contact channels: PSE members read and insert; contact owner or admin updates/deletes
DROP POLICY IF EXISTS contact_channels_read ON contact_channels;
CREATE POLICY contact_channels_read ON contact_channels
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS contact_channels_insert ON contact_channels;
CREATE POLICY contact_channels_insert ON contact_channels
FOR INSERT WITH CHECK (is_pse_member());

DROP POLICY IF EXISTS contact_channels_modify ON contact_channels;
CREATE POLICY contact_channels_modify ON contact_channels
FOR ALL
USING (
  is_pse_member() AND (
    has_role(ARRAY['admin']::app_role[]) OR
    EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_channels.contact_id AND c.owner_id = current_app_user_id())
  )
);

-- Pipelines: PSE members read and insert; focal_person, creator, or admin updates/deletes
DROP POLICY IF EXISTS pipelines_read ON pipelines;
CREATE POLICY pipelines_read ON pipelines
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS pipelines_insert ON pipelines;
CREATE POLICY pipelines_insert ON pipelines
FOR INSERT WITH CHECK (is_pse_member());

DROP POLICY IF EXISTS pipelines_update ON pipelines;
CREATE POLICY pipelines_update ON pipelines
FOR UPDATE
USING (
  is_pse_member() AND (
    focal_person_id = current_app_user_id() OR
    created_by = current_app_user_id() OR
    has_role(ARRAY['admin']::app_role[])
  )
);

DROP POLICY IF EXISTS pipelines_delete ON pipelines;
CREATE POLICY pipelines_delete ON pipelines
FOR DELETE
USING (is_pse_member() AND has_role(ARRAY['admin']::app_role[]));

-- Pipeline stage history: PSE members read; inserts handled by trigger or PSE member
DROP POLICY IF EXISTS pipeline_stage_history_read ON pipeline_stage_history;
CREATE POLICY pipeline_stage_history_read ON pipeline_stage_history
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS pipeline_stage_history_insert ON pipeline_stage_history;
CREATE POLICY pipeline_stage_history_insert ON pipeline_stage_history
FOR INSERT WITH CHECK (is_pse_member());

-- Pipeline receipts: PSE members read; pipeline focal_person/creator or admin inserts/updates
DROP POLICY IF EXISTS pipeline_receipts_read ON pipeline_receipts;
CREATE POLICY pipeline_receipts_read ON pipeline_receipts
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS pipeline_receipts_write ON pipeline_receipts;
CREATE POLICY pipeline_receipts_write ON pipeline_receipts
FOR ALL
USING (
  is_pse_member() AND (
    has_role(ARRAY['admin']::app_role[]) OR
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_receipts.pipeline_id
        AND (p.focal_person_id = current_app_user_id() OR p.created_by = current_app_user_id())
    )
  )
)
WITH CHECK (
  is_pse_member() AND (
    has_role(ARRAY['admin']::app_role[]) OR
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_receipts.pipeline_id
        AND (p.focal_person_id = current_app_user_id() OR p.created_by = current_app_user_id())
    )
  )
);

-- Meetings: PSE members read and insert; owner or admin updates/deletes
DROP POLICY IF EXISTS meetings_read ON meetings;
CREATE POLICY meetings_read ON meetings
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS meetings_insert ON meetings;
CREATE POLICY meetings_insert ON meetings
FOR INSERT WITH CHECK (is_pse_member());

DROP POLICY IF EXISTS meetings_update ON meetings;
CREATE POLICY meetings_update ON meetings
FOR UPDATE
USING (is_pse_member() AND (owner_id = current_app_user_id() OR has_role(ARRAY['admin']::app_role[])));

DROP POLICY IF EXISTS meetings_delete ON meetings;
CREATE POLICY meetings_delete ON meetings
FOR DELETE
USING (is_pse_member() AND (owner_id = current_app_user_id() OR has_role(ARRAY['admin']::app_role[])));

-- Activities: PSE members read and insert; owner or admin updates/deletes
DROP POLICY IF EXISTS activities_read ON activities;
CREATE POLICY activities_read ON activities
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS activities_insert ON activities;
CREATE POLICY activities_insert ON activities
FOR INSERT WITH CHECK (is_pse_member());

DROP POLICY IF EXISTS activities_update ON activities;
CREATE POLICY activities_update ON activities
FOR UPDATE
USING (is_pse_member() AND (owner_id = current_app_user_id() OR has_role(ARRAY['admin']::app_role[])));

DROP POLICY IF EXISTS activities_delete ON activities;
CREATE POLICY activities_delete ON activities
FOR DELETE
USING (is_pse_member() AND (owner_id = current_app_user_id() OR has_role(ARRAY['admin']::app_role[])));

-- Targets (plans, quarters, lines): PSE members read; ONLY admin or target_manager can write
DROP POLICY IF EXISTS target_plans_read ON target_plans;
CREATE POLICY target_plans_read ON target_plans
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS target_plans_write ON target_plans;
CREATE POLICY target_plans_write ON target_plans
FOR ALL
USING (has_role(ARRAY['admin', 'target_manager']::app_role[]))
WITH CHECK (has_role(ARRAY['admin', 'target_manager']::app_role[]));

DROP POLICY IF EXISTS target_quarters_read ON target_quarters;
CREATE POLICY target_quarters_read ON target_quarters
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS target_quarters_write ON target_quarters;
CREATE POLICY target_quarters_write ON target_quarters
FOR ALL
USING (has_role(ARRAY['admin', 'target_manager']::app_role[]))
WITH CHECK (has_role(ARRAY['admin', 'target_manager']::app_role[]));

DROP POLICY IF EXISTS target_lines_read ON target_lines;
CREATE POLICY target_lines_read ON target_lines
FOR SELECT USING (is_pse_member());

DROP POLICY IF EXISTS target_lines_write ON target_lines;
CREATE POLICY target_lines_write ON target_lines
FOR ALL
USING (has_role(ARRAY['admin', 'target_manager']::app_role[]))
WITH CHECK (has_role(ARRAY['admin', 'target_manager']::app_role[]));

-- Audit log: PSE members can read
DROP POLICY IF EXISTS audit_log_read ON audit_log;
CREATE POLICY audit_log_read ON audit_log
FOR SELECT USING (is_pse_member());
