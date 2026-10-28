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
 * Runs on the owner connection, so callers must authorise first (requireUser in queries.ts).
 * Values are always bound parameters, never interpolated into SQL.
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
  const res = await queryDb<{
    members: { id: string; full_name: string }[];
    verticals: { id: string; name: string }[];
  }>(
    `SELECT
       COALESCE((SELECT json_agg(row_to_json(m)) FROM (SELECT id, full_name FROM profiles) m), '[]'::json) AS members,
       COALESCE((SELECT json_agg(row_to_json(v)) FROM (SELECT id, name FROM verticals) v), '[]'::json) AS verticals`,
  );
  const row = res.rows[0];
  return {
    members: Object.fromEntries((row?.members ?? []).map((m) => [m.id, m.full_name])),
    verticals: Object.fromEntries((row?.verticals ?? []).map((v) => [v.id, v.name])),
  };
}

export async function fetchMonetaryRaw(
  window: DashboardWindow,
  member: string | null,
  vertical: string | null,
): Promise<MonetaryRaw> {
  const res = await queryDb<{
    achievements: AchievementRow[];
    targets: TargetRow[];
    pipeline_by_kind: PipelineKindRow[];
    won_unrealized: WonUnrealizedRow | null;
    lead_count: number;
    trend: TrendRow[];
  }>(
    `SELECT
       COALESCE((
         SELECT json_agg(row_to_json(r))
         FROM (
           SELECT user_id, vertical_id, achieved::float8 AS achieved
           FROM fn_achievement($1::date, $2::date, $3::uuid, $4::uuid)
         ) r
       ), '[]'::json) AS achievements,
       COALESCE((
         SELECT json_agg(row_to_json(r))
         FROM (
           SELECT user_id, vertical_id, target::float8 AS target
           FROM fn_target($5::int, $6::int, $7::int, $3::uuid, $4::uuid)
         ) r
       ), '[]'::json) AS targets,
       COALESCE((
         SELECT json_agg(row_to_json(r))
         FROM (
           SELECT kind, pipeline_count, expected_base::float8 AS expected_base,
                  cash_base::float8 AS cash_base, in_kind_base::float8 AS in_kind_base
           FROM fn_pipeline_by_kind($1::date, $2::date, $3::uuid, $4::uuid)
         ) r
       ), '[]'::json) AS pipeline_by_kind,
       (
         SELECT row_to_json(r)
         FROM (
           SELECT won_base::float8 AS won_base, received_base::float8 AS received_base,
                  unrealized_base::float8 AS unrealized_base
           FROM fn_won_unrealized($1::date, $2::date, $3::uuid, $4::uuid)
         ) r
       ) AS won_unrealized,
       fn_lead_count($1::date, $2::date, $3::uuid, $4::uuid) AS lead_count,
       COALESCE((
         SELECT json_agg(row_to_json(r))
         FROM (
           SELECT month_index, month_start::text AS month_start, achieved::float8 AS achieved
           FROM fn_trend($5::int, $3::uuid, $4::uuid)
         ) r
       ), '[]'::json) AS trend`,
    [
      window.start,
      window.end,
      member,
      vertical,
      window.targetYear,
      window.targetQuarter,
      window.targetMonth,
    ],
  );

  const row = res.rows[0];
  return {
    achievements: row?.achievements ?? [],
    targets: row?.targets ?? [],
    pipelineByKind: row?.pipeline_by_kind ?? [],
    wonUnrealized: row?.won_unrealized ?? null,
    leadCount: row?.lead_count ?? 0,
    trend: row?.trend ?? [],
  };
}

export async function fetchNonMonetaryRaw(
  window: DashboardWindow,
  member: string | null,
): Promise<NonMonetaryRaw> {
  const res = await queryDb<{
    meetings: MeetingRow[];
    activities: ActivityRow[];
    engaged: number;
    workload: WorkloadRow[];
  }>(
    `SELECT
       COALESCE((
         SELECT json_agg(row_to_json(r))
         FROM (
           SELECT status, meeting_count
           FROM fn_meeting_summary($1::date, $2::date, $3::uuid)
         ) r
       ), '[]'::json) AS meetings,
       COALESCE((
         SELECT json_agg(row_to_json(r))
         FROM (
           SELECT type, class, activity_count, distinct_contacts
           FROM fn_activity_summary($1::date, $2::date, $3::uuid)
         ) r
       ), '[]'::json) AS activities,
       fn_contacts_engaged($1::date, $2::date, $3::uuid) AS engaged,
       COALESCE((
         SELECT json_agg(row_to_json(r))
         FROM (
           SELECT user_id, full_name, meeting_count, activity_count
           FROM fn_member_workload($1::date, $2::date, $3::uuid)
         ) r
       ), '[]'::json) AS workload`,
    [window.start, window.end, member],
  );

  const row = res.rows[0];
  return {
    meetings: row?.meetings ?? [],
    activities: row?.activities ?? [],
    contactsEngaged: row?.engaged ?? 0,
    workload: row?.workload ?? [],
  };
}
