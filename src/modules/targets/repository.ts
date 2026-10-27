import type { PoolClient } from 'pg';
import { withUserTransaction } from '@/shared/lib/supabase/server';
import type { AppRole } from '@/types/database';
import type { TargetPlanDraft } from './schema';
import { buildPlanLines, type TargetPlanLine } from './service';

export interface TargetMemberOption {
  id: string;
  full_name: string;
  role: AppRole;
}

export interface TargetVerticalOption {
  id: string;
  name: string;
}

export interface TargetPlanYear {
  year: number;
  published: boolean;
}

export interface TargetPlanRecord {
  id: string;
  year: number;
  team_id: string | null;
  annual_amount: number;
  locked_at: string | null;
  locked_by: string | null;
  locked_by_name: string | null;
  /** Quarter amounts indexed by quarter - 1 (always four entries). */
  quarters: number[];
  lines: TargetPlanLine[];
}

/**
 * The plan's team: the actor's own team, or the first team when the actor has none.
 * Plans are unique per (year, team), so a null team would break that guarantee.
 */
async function resolveTeamId(client: PoolClient, profileTeamId: string | null): Promise<string> {
  if (profileTeamId) return profileTeamId;
  const res = await client.query<{ id: string }>(`SELECT id FROM teams ORDER BY name ASC LIMIT 1`);
  if (!res.rows[0]) {
    throw new Error('No team exists yet. Create the PSE team before setting targets.');
  }
  return res.rows[0].id;
}

/**
 * Active PSE members, plus anyone in `includeUserIds` even if since deactivated (labelled
 * "(inactive)"), so existing target lines never lose their row in a summary or a draft.
 */
export async function listTargetMembers(
  userId: string,
  includeUserIds: string[] = [],
): Promise<TargetMemberOption[]> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<TargetMemberOption>(
      `SELECT
         id,
         CASE WHEN is_pse AND is_active THEN full_name ELSE full_name || ' (inactive)' END AS full_name,
         role
       FROM profiles
       WHERE (is_pse = true AND is_active = true) OR id = ANY($1::uuid[])
       ORDER BY full_name ASC`,
      [includeUserIds],
    );
    return res.rows;
  });
}

export async function listTargetVerticals(userId: string): Promise<TargetVerticalOption[]> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<TargetVerticalOption>(
      `SELECT id, name FROM verticals ORDER BY name ASC`,
    );
    return res.rows;
  });
}

export async function listTargetPlanYears(
  userId: string,
  profileTeamId: string | null,
  includeDrafts: boolean,
): Promise<TargetPlanYear[]> {
  return withUserTransaction(userId, async (client) => {
    const teamId = await resolveTeamId(client, profileTeamId);
    const res = await client.query<{ year: number; published: boolean }>(
      `SELECT year, (locked_at IS NOT NULL) AS published
       FROM target_plans
       WHERE team_id = $1
         AND ($2::boolean OR locked_at IS NOT NULL)
       ORDER BY year DESC`,
      [teamId, includeDrafts],
    );
    return res.rows;
  });
}

export async function getTargetPlan(
  userId: string,
  profileTeamId: string | null,
  year: number,
  includeDraft: boolean,
): Promise<TargetPlanRecord | null> {
  return withUserTransaction(userId, async (client) => {
    const teamId = await resolveTeamId(client, profileTeamId);

    const planRes = await client.query<Omit<TargetPlanRecord, 'quarters' | 'lines'>>(
      `SELECT
         p.id,
         p.year,
         p.team_id,
         p.annual_amount::float8 AS annual_amount,
         p.locked_at::text,
         p.locked_by,
         lb.full_name AS locked_by_name
       FROM target_plans p
       LEFT JOIN profiles lb ON lb.id = p.locked_by
       WHERE p.year = $1
         AND p.team_id = $2
         AND ($3::boolean OR p.locked_at IS NOT NULL)`,
      [year, teamId, includeDraft],
    );

    const plan = planRes.rows[0];
    if (!plan) return null;

    const [quartersRes, linesRes] = await Promise.all([
      client.query<{ quarter: number; amount: number }>(
        `SELECT quarter, amount::float8 AS amount
         FROM target_quarters
         WHERE plan_id = $1`,
        [plan.id],
      ),
      client.query<TargetPlanLine>(
        `SELECT
           q.quarter,
           l.user_id,
           l.vertical_id,
           l.percent::float8 AS percent,
           l.amount::float8 AS amount
         FROM target_lines l
         JOIN target_quarters q ON q.id = l.quarter_id
         WHERE q.plan_id = $1
         ORDER BY q.quarter ASC`,
        [plan.id],
      ),
    ]);

    const quarters = [0, 0, 0, 0];
    for (const row of quartersRes.rows) {
      quarters[row.quarter - 1] = row.amount;
    }

    return { ...plan, quarters, lines: linesRes.rows };
  });
}

/**
 * Saves the whole draft in one transaction, replacing the plan's quarters and lines.
 * Draft saves are permissive about totals (those are enforced on publish); the lock triggers
 * make it impossible to touch a published plan.
 */
export async function saveTargetDraft(
  userId: string,
  profileTeamId: string | null,
  draft: TargetPlanDraft,
): Promise<{ planId: string }> {
  return withUserTransaction(userId, async (client) => {
    const teamId = await resolveTeamId(client, profileTeamId);

    const existing = await client.query<{ id: string; locked_at: string | null }>(
      `SELECT id, locked_at::text
       FROM target_plans
       WHERE year = $1 AND team_id = $2
       FOR UPDATE`,
      [draft.year, teamId],
    );

    let planId: string;
    if (existing.rows[0]) {
      if (existing.rows[0].locked_at) {
        throw new Error('This target plan is published and can no longer be changed.');
      }
      planId = existing.rows[0].id;
      await client.query(`UPDATE target_plans SET annual_amount = $1 WHERE id = $2`, [
        draft.annual_amount,
        planId,
      ]);
      await client.query(
        `DELETE FROM target_lines
         WHERE quarter_id IN (SELECT id FROM target_quarters WHERE plan_id = $1)`,
        [planId],
      );
      await client.query(`DELETE FROM target_quarters WHERE plan_id = $1`, [planId]);
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO target_plans (year, team_id, annual_amount)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [draft.year, teamId, draft.annual_amount],
      );
      planId = inserted.rows[0].id;
    }

    const quarterIds = new Map<number, string>();
    for (let i = 0; i < 4; i += 1) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO target_quarters (plan_id, quarter, amount)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [planId, i + 1, draft.quarters[i]],
      );
      quarterIds.set(i + 1, res.rows[0].id);
    }

    for (const line of buildPlanLines(draft)) {
      await client.query(
        `INSERT INTO target_lines (quarter_id, user_id, vertical_id, percent, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [quarterIds.get(line.quarter), line.user_id, line.vertical_id, line.percent, line.amount],
      );
    }

    return { planId };
  });
}

/** Publishes (locks) a plan. `publish_target_plan` re-verifies every total and the role. */
export async function publishTargetPlanRecord(userId: string, planId: string): Promise<void> {
  await withUserTransaction(userId, async (client) => {
    await client.query(`SELECT publish_target_plan($1)`, [planId]);
  });
}

export async function deleteTargetDraft(
  userId: string,
  profileTeamId: string | null,
  year: number,
): Promise<void> {
  await withUserTransaction(userId, async (client) => {
    const teamId = await resolveTeamId(client, profileTeamId);
    const res = await client.query<{ locked_at: string | null }>(
      `SELECT locked_at::text FROM target_plans WHERE year = $1 AND team_id = $2 FOR UPDATE`,
      [year, teamId],
    );
    if (!res.rows[0]) return;
    if (res.rows[0].locked_at) {
      throw new Error('A published target plan cannot be deleted.');
    }
    await client.query(
      `DELETE FROM target_lines
       WHERE quarter_id IN (
         SELECT q.id FROM target_quarters q
         JOIN target_plans p ON p.id = q.plan_id
         WHERE p.year = $1 AND p.team_id = $2
       )`,
      [year, teamId],
    );
    await client.query(
      `DELETE FROM target_quarters
       WHERE plan_id IN (SELECT id FROM target_plans WHERE year = $1 AND team_id = $2)`,
      [year, teamId],
    );
    await client.query(`DELETE FROM target_plans WHERE year = $1 AND team_id = $2`, [year, teamId]);
  });
}
