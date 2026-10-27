import { queryDb } from '@/shared/lib/supabase/admin';
import type {
  AchievementRow,
  ActivityRow,
  DashboardWindow,
  MeetingRow,
  MonetaryRaw,
  NameLookup,
  NonMonetaryRaw,
  PipelineKindRow,
  TargetRow,
  TrendRow,
  WonUnrealizedRow,
  WorkloadRow,
} from './service';

export interface DashboardMemberOption {
  id: string;
  full_name: string;
}

export interface DashboardVerticalOption {
  id: string;
  name: string;
}

/*
 * Every function here runs on the owner connection, so callers MUST authorise the user first
 * (`requireUser()` in queries.ts) and only pass in already-validated filters. All values are bound
 * parameters; nothing is interpolated into SQL.
 */

export async function getFiscalStartMonth(): Promise<number> {
  const res = await queryDb<{ month: number }>(`SELECT fn_fiscal_start_month() AS month`);
  return res.rows[0]?.month ?? 1;
}

export async function listDashboardMembers(): Promise<DashboardMemberOption[]> {
  const res = await queryDb<DashboardMemberOption>(
    `SELECT id, full_name
     FROM profiles
     WHERE is_pse = true AND is_active = true
     ORDER BY full_name ASC`,
  );
  return res.rows;
}

export async function listDashboardVerticals(): Promise<DashboardVerticalOption[]> {
  const res = await queryDb<DashboardVerticalOption>(
    `SELECT id, name FROM verticals ORDER BY name ASC`,
  );
  return res.rows;
}

/** Names for every member (including since-deactivated ones) and vertical, to label result rows. */
export async function getNameLookup(): Promise<NameLookup> {
  const [members, verticals] = await Promise.all([
    queryDb<{ id: string; full_name: string }>(`SELECT id, full_name FROM profiles`),
    queryDb<{ id: string; name: string }>(`SELECT id, name FROM verticals`),
  ]);
  return {
    members: Object.fromEntries(members.rows.map((m) => [m.id, m.full_name])),
    verticals: Object.fromEntries(verticals.rows.map((v) => [v.id, v.name])),
  };
}

export async function fetchMonetaryRaw(
  window: DashboardWindow,
  member: string | null,
  vertical: string | null,
): Promise<MonetaryRaw> {
  const range = [window.start, window.end, member, vertical];

  const [achievements, targets, pipelineByKind, won, lead, trend] = await Promise.all([
    queryDb<AchievementRow>(
      `SELECT user_id, vertical_id, achieved::float8 AS achieved
       FROM fn_achievement($1::date, $2::date, $3::uuid, $4::uuid)`,
      range,
    ),
    queryDb<TargetRow>(
      `SELECT user_id, vertical_id, target::float8 AS target
       FROM fn_target($1::int, $2::int, $3::int, $4::uuid, $5::uuid)`,
      [window.targetYear, window.targetQuarter, window.targetMonth, member, vertical],
    ),
    queryDb<PipelineKindRow>(
      `SELECT kind, pipeline_count, expected_base::float8 AS expected_base,
              cash_base::float8 AS cash_base, in_kind_base::float8 AS in_kind_base
       FROM fn_pipeline_by_kind($1::date, $2::date, $3::uuid, $4::uuid)`,
      range,
    ),
    queryDb<WonUnrealizedRow>(
      `SELECT won_base::float8 AS won_base, received_base::float8 AS received_base,
              unrealized_base::float8 AS unrealized_base
       FROM fn_won_unrealized($1::date, $2::date, $3::uuid, $4::uuid)`,
      range,
    ),
    queryDb<{ lead_count: number }>(
      `SELECT fn_lead_count($1::date, $2::date, $3::uuid, $4::uuid) AS lead_count`,
      range,
    ),
    queryDb<TrendRow>(
      `SELECT month_index, month_start::text AS month_start, achieved::float8 AS achieved
       FROM fn_trend($1::int, $2::uuid, $3::uuid)`,
      [window.targetYear, member, vertical],
    ),
  ]);

  return {
    achievements: achievements.rows,
    targets: targets.rows,
    pipelineByKind: pipelineByKind.rows,
    wonUnrealized: won.rows[0] ?? null,
    leadCount: lead.rows[0]?.lead_count ?? 0,
    trend: trend.rows,
  };
}

export async function fetchNonMonetaryRaw(
  window: DashboardWindow,
  member: string | null,
): Promise<NonMonetaryRaw> {
  const range = [window.start, window.end, member];

  const [meetings, activities, engaged, workload] = await Promise.all([
    queryDb<MeetingRow>(
      `SELECT status, meeting_count FROM fn_meeting_summary($1::date, $2::date, $3::uuid)`,
      range,
    ),
    queryDb<ActivityRow>(
      `SELECT type, class, activity_count, distinct_contacts
       FROM fn_activity_summary($1::date, $2::date, $3::uuid)`,
      range,
    ),
    queryDb<{ engaged: number }>(
      `SELECT fn_contacts_engaged($1::date, $2::date, $3::uuid) AS engaged`,
      range,
    ),
    queryDb<WorkloadRow>(
      `SELECT user_id, full_name, meeting_count, activity_count
       FROM fn_member_workload($1::date, $2::date, $3::uuid)`,
      range,
    ),
  ]);

  return {
    meetings: meetings.rows,
    activities: activities.rows,
    contactsEngaged: engaged.rows[0]?.engaged ?? 0,
    workload: workload.rows,
  };
}
