-- 009_dashboard_functions.sql
-- Read-model functions behind the two-lens dashboard. Each KPI formula lives in exactly one function
-- so a change in definition (for example the Lead KPI) is a one-place edit.
--
-- Conventions
--   * p_start / p_end are inclusive dates. p_user / p_vertical are optional filters (NULL = all).
--   * Achievement is money actually received (pipeline_receipts.amount_base), never forecast or won value.
--   * Only PUBLISHED (locked) target plans count as targets.
--   * Non-monetary functions (meetings, activities) never read any monetary column.
--   * These run on the owner connection after the caller has been authorised (cached dashboard reads),
--     so they are plain SQL functions with no RLS dependency.

CREATE OR REPLACE FUNCTION fn_fiscal_start_month()
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((SELECT value::int FROM settings WHERE key = 'fiscal_year_start_month'), 1);
$$;

-- Achievement: money received in the window, by focal person and vertical.
CREATE OR REPLACE FUNCTION fn_achievement(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL,
  p_vertical uuid DEFAULT NULL
)
RETURNS TABLE (user_id uuid, vertical_id uuid, achieved numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT p.focal_person_id, m.vertical_id, SUM(r.amount_base)
  FROM pipeline_receipts r
  JOIN pipelines p ON p.id = r.pipeline_id
  JOIN category_vertical_map m ON m.category_id = p.category_id
  WHERE r.received_on BETWEEN p_start AND p_end
    AND (p_user IS NULL OR p.focal_person_id = p_user)
    AND (p_vertical IS NULL OR m.vertical_id = p_vertical)
  GROUP BY p.focal_person_id, m.vertical_id;
$$;

-- Target for the same window from published plans.
--   year only            -> sum of all four quarters
--   p_quarter            -> that quarter, exact
--   p_month (1-12 in the fiscal year) -> that month's quarter / 3 (pro-rata, labelled as such in the UI)
-- No carry-forward: a quarter's target is never adjusted by another quarter's result.
CREATE OR REPLACE FUNCTION fn_target(
  p_year int,
  p_quarter int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_user uuid DEFAULT NULL,
  p_vertical uuid DEFAULT NULL
)
RETURNS TABLE (user_id uuid, vertical_id uuid, target numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.user_id,
    l.vertical_id,
    ROUND(SUM(CASE WHEN p_month IS NOT NULL THEN l.amount / 3 ELSE l.amount END), 2)
  FROM target_plans tp
  JOIN target_quarters tq ON tq.plan_id = tp.id
  JOIN target_lines l ON l.quarter_id = tq.id
  WHERE tp.year = p_year
    AND tp.locked_at IS NOT NULL
    AND (
      COALESCE(p_quarter, CASE WHEN p_month IS NOT NULL THEN ((p_month - 1) / 3) + 1 END) IS NULL
      OR tq.quarter = COALESCE(p_quarter, ((p_month - 1) / 3) + 1)
    )
    AND (p_user IS NULL OR l.user_id = p_user)
    AND (p_vertical IS NULL OR l.vertical_id = p_vertical)
  GROUP BY l.user_id, l.vertical_id;
$$;

-- Pipelines created in the window, grouped by the CURRENT stage kind (open / won / lost / junk).
-- Always returns all four kinds, with zeros, so charts and tables keep a stable shape.
CREATE OR REPLACE FUNCTION fn_pipeline_by_kind(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL,
  p_vertical uuid DEFAULT NULL
)
RETURNS TABLE (kind stage_kind, pipeline_count int, expected_base numeric, cash_base numeric, in_kind_base numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    k.kind,
    COUNT(f.id)::int,
    COALESCE(SUM(f.amount_base), 0),
    COALESCE(SUM(f.amount_base) FILTER (WHERE f.contribution_type = 'cash'), 0),
    COALESCE(SUM(f.amount_base) FILTER (WHERE f.contribution_type = 'in_kind'), 0)
  FROM unnest(enum_range(NULL::stage_kind)) AS k(kind)
  LEFT JOIN (
    SELECT p.id, p.amount_base, p.contribution_type, s.kind AS stage_kind
    FROM pipelines p
    JOIN pipeline_stages s ON s.id = p.stage_id
    JOIN category_vertical_map m ON m.category_id = p.category_id
    WHERE p.created_at::date BETWEEN p_start AND p_end
      AND (p_user IS NULL OR p.focal_person_id = p_user)
      AND (p_vertical IS NULL OR m.vertical_id = p_vertical)
  ) f ON f.stage_kind = k.kind
  GROUP BY k.kind
  ORDER BY k.kind;
$$;

-- Won in the window but not yet fully received. Per deal the shortfall is floored at zero, so an
-- over-received deal never hides another deal's outstanding amount.
CREATE OR REPLACE FUNCTION fn_won_unrealized(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL,
  p_vertical uuid DEFAULT NULL
)
RETURNS TABLE (won_base numeric, received_base numeric, unrealized_base numeric)
LANGUAGE sql
STABLE
AS $$
  WITH won AS (
    SELECT p.id, p.amount_base
    FROM pipelines p
    JOIN pipeline_stages s ON s.id = p.stage_id
    JOIN category_vertical_map m ON m.category_id = p.category_id
    WHERE s.kind = 'won'
      AND p.won_at::date BETWEEN p_start AND p_end
      AND (p_user IS NULL OR p.focal_person_id = p_user)
      AND (p_vertical IS NULL OR m.vertical_id = p_vertical)
  ),
  received AS (
    SELECT r.pipeline_id, SUM(r.amount_base) AS total
    FROM pipeline_receipts r
    WHERE r.pipeline_id IN (SELECT id FROM won)
    GROUP BY r.pipeline_id
  )
  SELECT
    COALESCE(SUM(w.amount_base), 0),
    COALESCE(SUM(COALESCE(rc.total, 0)), 0),
    COALESCE(SUM(GREATEST(w.amount_base - COALESCE(rc.total, 0), 0)), 0)
  FROM won w
  LEFT JOIN received rc ON rc.pipeline_id = w.id;
$$;

-- Lead KPI. PSE has not confirmed the formula: for now a lead is a pipeline created in the window.
-- This is the single place to change it.
CREATE OR REPLACE FUNCTION fn_lead_count(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL,
  p_vertical uuid DEFAULT NULL
)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::int
  FROM pipelines p
  JOIN category_vertical_map m ON m.category_id = p.category_id
  WHERE p.created_at::date BETWEEN p_start AND p_end
    AND (p_user IS NULL OR p.focal_person_id = p_user)
    AND (p_vertical IS NULL OR m.vertical_id = p_vertical);
$$;

-- Meetings by status, dated by their scheduled time. Always returns both statuses.
CREATE OR REPLACE FUNCTION fn_meeting_summary(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL
)
RETURNS TABLE (status meeting_status, meeting_count int)
LANGUAGE sql
STABLE
AS $$
  SELECT st.status, COUNT(m.id)::int
  FROM unnest(enum_range(NULL::meeting_status)) AS st(status)
  LEFT JOIN meetings m
    ON m.status = st.status
   AND m.scheduled_at::date BETWEEN p_start AND p_end
   AND (p_user IS NULL OR m.owner_id = p_user)
  GROUP BY st.status
  ORDER BY st.status;
$$;

-- Activities by type and class. Dated by occurred_at, else due_at, else created_at. Cancelled work
-- is not counted. Never reads a monetary column.
CREATE OR REPLACE FUNCTION fn_activity_summary(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL
)
RETURNS TABLE (type activity_type, class activity_class, activity_count int, distinct_contacts int)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.type,
    a.class,
    COUNT(*)::int,
    COUNT(DISTINCT a.contact_id)::int
  FROM activities a
  WHERE a.status <> 'cancelled'
    AND COALESCE(a.occurred_at, a.due_at, a.created_at)::date BETWEEN p_start AND p_end
    AND (p_user IS NULL OR a.owner_id = p_user)
  GROUP BY a.type, a.class
  ORDER BY a.type, a.class;
$$;

-- Distinct contacts touched by an activity or a meeting in the window (a meeting's contact falls
-- back to its pipeline's contact).
CREATE OR REPLACE FUNCTION fn_contacts_engaged(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL
)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT contact_id)::int
  FROM (
    SELECT a.contact_id
    FROM activities a
    WHERE a.contact_id IS NOT NULL
      AND a.status <> 'cancelled'
      AND COALESCE(a.occurred_at, a.due_at, a.created_at)::date BETWEEN p_start AND p_end
      AND (p_user IS NULL OR a.owner_id = p_user)
    UNION ALL
    SELECT COALESCE(m.contact_id, p.contact_id)
    FROM meetings m
    LEFT JOIN pipelines p ON p.id = m.pipeline_id
    WHERE COALESCE(m.contact_id, p.contact_id) IS NOT NULL
      AND m.scheduled_at::date BETWEEN p_start AND p_end
      AND (p_user IS NULL OR m.owner_id = p_user)
  ) engaged;
$$;

-- Per-member workload (meetings + activities) for every active PSE member, zeros included.
CREATE OR REPLACE FUNCTION fn_member_workload(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL
)
RETURNS TABLE (user_id uuid, full_name text, meeting_count int, activity_count int)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pr.id,
    pr.full_name,
    (
      SELECT COUNT(*)::int FROM meetings m
      WHERE m.owner_id = pr.id AND m.scheduled_at::date BETWEEN p_start AND p_end
    ),
    (
      SELECT COUNT(*)::int FROM activities a
      WHERE a.owner_id = pr.id
        AND a.status <> 'cancelled'
        AND COALESCE(a.occurred_at, a.due_at, a.created_at)::date BETWEEN p_start AND p_end
    )
  FROM profiles pr
  WHERE pr.is_pse = true
    AND pr.is_active = true
    AND (p_user IS NULL OR pr.id = p_user)
  ORDER BY pr.full_name;
$$;

-- Achievement per month of the (fiscal) year, always twelve rows.
CREATE OR REPLACE FUNCTION fn_trend(
  p_year int,
  p_user uuid DEFAULT NULL,
  p_vertical uuid DEFAULT NULL
)
RETURNS TABLE (month_index int, month_start date, achieved numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    g.i + 1,
    ms.month_start,
    COALESCE((
      SELECT SUM(r.amount_base)
      FROM pipeline_receipts r
      JOIN pipelines p ON p.id = r.pipeline_id
      JOIN category_vertical_map m ON m.category_id = p.category_id
      WHERE r.received_on >= ms.month_start
        AND r.received_on < (ms.month_start + INTERVAL '1 month')::date
        AND (p_user IS NULL OR p.focal_person_id = p_user)
        AND (p_vertical IS NULL OR m.vertical_id = p_vertical)
    ), 0)
  FROM generate_series(0, 11) AS g(i)
  CROSS JOIN LATERAL (
    SELECT (make_date(p_year, fn_fiscal_start_month(), 1) + (g.i || ' months')::interval)::date AS month_start
  ) ms
  ORDER BY g.i;
$$;

CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON pipelines(created_at);
CREATE INDEX IF NOT EXISTS idx_pipelines_won_at ON pipelines(won_at) WHERE won_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_receipts_pipeline ON pipeline_receipts(pipeline_id);
