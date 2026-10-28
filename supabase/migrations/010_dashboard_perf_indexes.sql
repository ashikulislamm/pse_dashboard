-- 010_dashboard_perf_indexes.sql
-- Indexes for the dashboard functions, plus rewrites of them that use range predicates (so the
-- indexes get used) and single-pass aggregation. Sized for ~10k contacts, 5k pipelines, 20k activities.

-- Covering index for fn_achievement and fn_trend
CREATE INDEX IF NOT EXISTS idx_pipeline_receipts_received_covering
  ON pipeline_receipts (received_on, pipeline_id)
  INCLUDE (amount_base);

-- Covering index for fn_pipeline_by_kind and fn_lead_count
CREATE INDEX IF NOT EXISTS idx_pipelines_created_covering
  ON pipelines (created_at, focal_person_id, category_id, stage_id)
  INCLUDE (amount_base, contribution_type);

-- Partial covering index for fn_won_unrealized
CREATE INDEX IF NOT EXISTS idx_pipelines_won_covering
  ON pipelines (won_at, focal_person_id, category_id, stage_id)
  INCLUDE (amount_base)
  WHERE won_at IS NOT NULL;

-- Covering index for fn_meeting_summary, fn_contacts_engaged, and fn_member_workload
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_covering
  ON meetings (scheduled_at, status, owner_id)
  INCLUDE (contact_id, pipeline_id);

-- Partial index on the effective timestamp, for fn_activity_summary, fn_contacts_engaged and fn_member_workload
CREATE INDEX IF NOT EXISTS idx_activities_effective_ts_covering
  ON activities (COALESCE(occurred_at, due_at, created_at), owner_id, type, class)
  INCLUDE (contact_id)
  WHERE status <> 'cancelled';

-- fn_pipeline_by_kind: range predicate so it can use idx_pipelines_created_covering
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
    WHERE p.created_at >= p_start::timestamptz
      AND p.created_at < (p_end + 1)::timestamptz
      AND (p_user IS NULL OR p.focal_person_id = p_user)
      AND (p_vertical IS NULL OR m.vertical_id = p_vertical)
  ) f ON f.stage_kind = k.kind
  GROUP BY k.kind
  ORDER BY k.kind;
$$;

-- fn_won_unrealized: uses idx_pipelines_won_covering
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
      AND p.won_at >= p_start::timestamptz
      AND p.won_at < (p_end + 1)::timestamptz
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

-- fn_lead_count: uses idx_pipelines_created_covering
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
  WHERE p.created_at >= p_start::timestamptz
    AND p.created_at < (p_end + 1)::timestamptz
    AND (p_user IS NULL OR p.focal_person_id = p_user)
    AND (p_vertical IS NULL OR m.vertical_id = p_vertical);
$$;

-- fn_meeting_summary: uses idx_meetings_scheduled_covering
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
   AND m.scheduled_at >= p_start::timestamptz
   AND m.scheduled_at < (p_end + 1)::timestamptz
   AND (p_user IS NULL OR m.owner_id = p_user)
  GROUP BY st.status
  ORDER BY st.status;
$$;

-- fn_activity_summary: uses idx_activities_effective_ts_covering
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
    AND COALESCE(a.occurred_at, a.due_at, a.created_at) >= p_start::timestamptz
    AND COALESCE(a.occurred_at, a.due_at, a.created_at) < (p_end + 1)::timestamptz
    AND (p_user IS NULL OR a.owner_id = p_user)
  GROUP BY a.type, a.class
  ORDER BY a.type, a.class;
$$;

-- fn_contacts_engaged: uses idx_activities_effective_ts_covering and idx_meetings_scheduled_covering
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
      AND COALESCE(a.occurred_at, a.due_at, a.created_at) >= p_start::timestamptz
      AND COALESCE(a.occurred_at, a.due_at, a.created_at) < (p_end + 1)::timestamptz
      AND (p_user IS NULL OR a.owner_id = p_user)
    UNION ALL
    SELECT COALESCE(m.contact_id, p.contact_id)
    FROM meetings m
    LEFT JOIN pipelines p ON p.id = m.pipeline_id
    WHERE COALESCE(m.contact_id, p.contact_id) IS NOT NULL
      AND m.scheduled_at >= p_start::timestamptz
      AND m.scheduled_at < (p_end + 1)::timestamptz
      AND (p_user IS NULL OR m.owner_id = p_user)
  ) engaged;
$$;

-- fn_member_workload: one pass instead of a correlated subquery per member
CREATE OR REPLACE FUNCTION fn_member_workload(
  p_start date,
  p_end date,
  p_user uuid DEFAULT NULL
)
RETURNS TABLE (user_id uuid, full_name text, meeting_count int, activity_count int)
LANGUAGE sql
STABLE
AS $$
  WITH m_counts AS (
    SELECT m.owner_id, COUNT(*)::int AS cnt
    FROM meetings m
    WHERE m.scheduled_at >= p_start::timestamptz
      AND m.scheduled_at < (p_end + 1)::timestamptz
      AND (p_user IS NULL OR m.owner_id = p_user)
    GROUP BY m.owner_id
  ),
  a_counts AS (
    SELECT a.owner_id, COUNT(*)::int AS cnt
    FROM activities a
    WHERE a.status <> 'cancelled'
      AND COALESCE(a.occurred_at, a.due_at, a.created_at) >= p_start::timestamptz
      AND COALESCE(a.occurred_at, a.due_at, a.created_at) < (p_end + 1)::timestamptz
      AND (p_user IS NULL OR a.owner_id = p_user)
    GROUP BY a.owner_id
  )
  SELECT
    pr.id,
    pr.full_name,
    COALESCE(mc.cnt, 0),
    COALESCE(ac.cnt, 0)
  FROM profiles pr
  LEFT JOIN m_counts mc ON mc.owner_id = pr.id
  LEFT JOIN a_counts ac ON ac.owner_id = pr.id
  WHERE pr.is_pse = true
    AND pr.is_active = true
    AND (p_user IS NULL OR pr.id = p_user)
  ORDER BY pr.full_name;
$$;

-- fn_trend: scans the 12-month window once instead of running 12 subqueries
CREATE OR REPLACE FUNCTION fn_trend(
  p_year int,
  p_user uuid DEFAULT NULL,
  p_vertical uuid DEFAULT NULL
)
RETURNS TABLE (month_index int, month_start date, achieved numeric)
LANGUAGE sql
STABLE
AS $$
  WITH months AS (
    SELECT
      g.i + 1 AS month_index,
      (make_date(p_year, fn_fiscal_start_month(), 1) + (g.i || ' months')::interval)::date AS month_start,
      (make_date(p_year, fn_fiscal_start_month(), 1) + ((g.i + 1) || ' months')::interval)::date AS month_end
    FROM generate_series(0, 11) AS g(i)
  ),
  bounds AS (
    SELECT MIN(month_start) AS y_start, MAX(month_end) AS y_end FROM months
  ),
  receipt_months AS (
    SELECT
      date_trunc('month', r.received_on)::date AS m_start,
      SUM(r.amount_base) AS achieved
    FROM pipeline_receipts r
    CROSS JOIN bounds b
    JOIN pipelines p ON p.id = r.pipeline_id
    JOIN category_vertical_map m ON m.category_id = p.category_id
    WHERE r.received_on >= b.y_start
      AND r.received_on < b.y_end
      AND (p_user IS NULL OR p.focal_person_id = p_user)
      AND (p_vertical IS NULL OR m.vertical_id = p_vertical)
    GROUP BY date_trunc('month', r.received_on)::date
  )
  SELECT
    mo.month_index,
    mo.month_start,
    COALESCE(rm.achieved, 0)
  FROM months mo
  LEFT JOIN receipt_months rm ON rm.m_start = mo.month_start
  ORDER BY mo.month_index;
$$;
