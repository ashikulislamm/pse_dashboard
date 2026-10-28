-- 003_pipelines.sql
-- Pipelines (money-only opportunities), stage history, and realized receipts

CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_name text NOT NULL,
  focal_person_id uuid NOT NULL REFERENCES profiles(id),
  contribution_type contribution_type NOT NULL,
  category_id uuid NOT NULL REFERENCES contribution_categories(id),
  party_type party_type NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  poc_contact_id uuid REFERENCES contacts(id),
  secondary_contact_id uuid REFERENCES contacts(id),
  stage_id uuid NOT NULL REFERENCES pipeline_stages(id),
  expected_amount numeric(18, 2) NOT NULL CHECK (expected_amount > 0),
  currency text NOT NULL REFERENCES currencies(code),
  amount_base numeric(18, 2) NOT NULL CHECK (amount_base > 0),
  payment_interval payment_interval NOT NULL DEFAULT 'one_time',
  expected_close date,
  country text,
  description text,
  operational_budget numeric(18, 2),
  notes text,
  in_kind_valuation_note text,
  lost_reason text,
  won_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contribution_type = 'cash' OR NULLIF(btrim(in_kind_valuation_note), '') IS NOT NULL),
  CHECK (party_type = 'individual' OR poc_contact_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS pipeline_stage_history (
  id bigserial PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  from_stage uuid REFERENCES pipeline_stages(id),
  to_stage uuid NOT NULL REFERENCES pipeline_stages(id),
  changed_by uuid REFERENCES profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL REFERENCES currencies(code),
  amount_base numeric(18, 2) NOT NULL CHECK (amount_base > 0),
  received_on date NOT NULL,
  note text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_stage ON pipelines(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_focal_created ON pipelines(focal_person_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pipelines_category ON pipelines(category_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_receipts_received_on ON pipeline_receipts(received_on);
CREATE INDEX IF NOT EXISTS idx_pipeline_receipts_pipeline ON pipeline_receipts(pipeline_id);

-- Before trigger: Lost needs lost_reason; moving to Won sets won_at
CREATE OR REPLACE FUNCTION fn_pipeline_stage_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_kind stage_kind;
BEGIN
  SELECT kind INTO v_kind FROM pipeline_stages WHERE id = NEW.stage_id;

  IF v_kind = 'won' AND NEW.won_at IS NULL THEN
    NEW.won_at := now();
  END IF;

  IF v_kind = 'lost' AND NULLIF(btrim(NEW.lost_reason), '') IS NULL THEN
    RAISE EXCEPTION 'lost_reason is required when moving pipeline to lost stage';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_stage_before ON pipelines;
CREATE TRIGGER trg_pipeline_stage_before
BEFORE INSERT OR UPDATE OF stage_id, lost_reason ON pipelines
FOR EACH ROW
EXECUTE FUNCTION fn_pipeline_stage_before_write();

-- After trigger: writes the first stage and every stage change to pipeline_stage_history
CREATE OR REPLACE FUNCTION fn_pipeline_stage_history_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
    NEW.created_by
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO pipeline_stage_history (pipeline_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, NULL, NEW.stage_id, v_actor);
  ELSIF TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO pipeline_stage_history (pipeline_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.stage_id, NEW.stage_id, v_actor);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_stage_history ON pipelines;
CREATE TRIGGER trg_pipeline_stage_history
AFTER INSERT OR UPDATE OF stage_id ON pipelines
FOR EACH ROW
EXECUTE FUNCTION fn_pipeline_stage_history_log();
