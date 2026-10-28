-- 008_targets_publish_guard.sql
-- publish_target_plan is SECURITY DEFINER (bypasses RLS), so without a role check any PSE member could
-- lock a plan by calling it directly. Adds the admin/target_manager guard; body otherwise unchanged from 005.

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
  IF NOT has_role(ARRAY['admin', 'target_manager']::app_role[]) THEN
    RAISE EXCEPTION 'only an admin or target manager can publish a target plan';
  END IF;

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
