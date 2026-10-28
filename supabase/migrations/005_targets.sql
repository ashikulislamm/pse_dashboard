-- 005_targets.sql
-- Target plans, quarters, member x vertical lines, and the lock triggers

CREATE TABLE IF NOT EXISTS target_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  annual_amount numeric(18, 2) NOT NULL CHECK (annual_amount > 0),
  locked_at timestamptz,
  locked_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, team_id)
);

CREATE TABLE IF NOT EXISTS target_quarters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES target_plans(id) ON DELETE CASCADE,
  quarter int NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  amount numeric(18, 2) NOT NULL CHECK (amount >= 0),
  UNIQUE (plan_id, quarter)
);

CREATE TABLE IF NOT EXISTS target_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter_id uuid NOT NULL REFERENCES target_quarters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  vertical_id uuid NOT NULL REFERENCES verticals(id),
  percent numeric(6, 3) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  amount numeric(18, 2) NOT NULL CHECK (amount >= 0),
  UNIQUE (quarter_id, user_id, vertical_id)
);

CREATE INDEX IF NOT EXISTS idx_target_quarters_plan ON target_quarters(plan_id);
CREATE INDEX IF NOT EXISTS idx_target_lines_quarter ON target_lines(quarter_id);
CREATE INDEX IF NOT EXISTS idx_target_lines_user_vertical ON target_lines(user_id, vertical_id);

-- 1. target_plans: no updates or deletes once locked_at is set
CREATE OR REPLACE FUNCTION fn_lock_guard_target_plans()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'target plan is locked and cannot be modified';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_guard_target_plans ON target_plans;
CREATE TRIGGER trg_lock_guard_target_plans
BEFORE UPDATE OR DELETE ON target_plans
FOR EACH ROW
EXECUTE FUNCTION fn_lock_guard_target_plans();

-- 2. target_quarters: reject changes when the plan is locked
CREATE OR REPLACE FUNCTION fn_lock_guard_target_quarters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_id uuid;
  v_locked_at timestamptz;
BEGIN
  v_plan_id := COALESCE(NEW.plan_id, OLD.plan_id);
  SELECT locked_at INTO v_locked_at FROM target_plans WHERE id = v_plan_id;
  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'target plan is locked and cannot be modified';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_guard_target_quarters ON target_quarters;
CREATE TRIGGER trg_lock_guard_target_quarters
BEFORE INSERT OR UPDATE OR DELETE ON target_quarters
FOR EACH ROW
EXECUTE FUNCTION fn_lock_guard_target_quarters();

-- 3. target_lines: reject changes when the plan is locked
CREATE OR REPLACE FUNCTION fn_lock_guard_target_lines()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_quarter_id uuid;
  v_locked_at timestamptz;
BEGIN
  v_quarter_id := COALESCE(NEW.quarter_id, OLD.quarter_id);
  SELECT p.locked_at INTO v_locked_at
  FROM target_quarters q
  JOIN target_plans p ON p.id = q.plan_id
  WHERE q.id = v_quarter_id;

  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'target plan is locked and cannot be modified';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_guard_target_lines ON target_lines;
CREATE TRIGGER trg_lock_guard_target_lines
BEFORE INSERT OR UPDATE OR DELETE ON target_lines
FOR EACH ROW
EXECUTE FUNCTION fn_lock_guard_target_lines();

-- 4. Publish: check every total reconciles, then lock the plan
CREATE OR REPLACE FUNCTION publish_target_plan(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annual numeric(18, 2);
  v_locked timestamptz;
  v_q_count int;
  v_q_sum numeric(18, 2);
  v_bad_quarter record;
  v_bad_percent record;
  v_actor uuid;
BEGIN
  SELECT annual_amount, locked_at INTO v_annual, v_locked
  FROM target_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target plan not found';
  END IF;

  IF v_locked IS NOT NULL THEN
    RAISE EXCEPTION 'target plan is already locked';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_q_count, v_q_sum
  FROM target_quarters
  WHERE plan_id = p_plan_id;

  IF v_q_count <> 4 THEN
    RAISE EXCEPTION 'target plan must have all 4 quarters before publishing';
  END IF;

  IF v_q_sum <> v_annual THEN
    RAISE EXCEPTION 'sum of quarterly targets (%) does not equal annual target (%)', v_q_sum, v_annual;
  END IF;

  -- Each quarter's lines must sum to the quarter amount
  SELECT q.quarter, q.amount AS q_amount, COALESCE(SUM(l.amount), 0) AS lines_sum
  INTO v_bad_quarter
  FROM target_quarters q
  LEFT JOIN target_lines l ON l.quarter_id = q.id
  WHERE q.plan_id = p_plan_id
  GROUP BY q.id, q.quarter, q.amount
  HAVING COALESCE(SUM(l.amount), 0) <> q.amount
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Q% member/vertical lines sum (%) does not equal quarter target (%)',
      v_bad_quarter.quarter, v_bad_quarter.lines_sum, v_bad_quarter.q_amount;
  END IF;

  -- Each member's vertical percentages must sum to 100% per quarter
  SELECT q.quarter, l.user_id, SUM(l.percent) AS pct_sum
  INTO v_bad_percent
  FROM target_quarters q
  JOIN target_lines l ON l.quarter_id = q.id
  WHERE q.plan_id = p_plan_id
  GROUP BY q.quarter, l.user_id
  HAVING ABS(SUM(l.percent) - 100) > 0.01
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'vertical percentages for Q% user % must sum to 100 (got %)',
      v_bad_percent.quarter, v_bad_percent.user_id, v_bad_percent.pct_sum;
  END IF;

  v_actor := NULLIF(current_setting('app.current_user_id', true), '')::uuid;

  UPDATE target_plans
  SET locked_at = now(),
      locked_by = COALESCE(v_actor, locked_by)
  WHERE id = p_plan_id;
END;
$$;
