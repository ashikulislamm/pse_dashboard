import { queryDb } from '@/shared/lib/supabase/admin';
import { withUserTransaction } from '@/shared/lib/supabase/server';
import type { AppRole, StageKind } from '@/types/database';

export interface ProfileRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: AppRole;
  team_id: string | null;
  is_pse: boolean;
  is_active: boolean;
  created_at: string;
}

export type PublicProfileRecord = Omit<ProfileRecord, 'password_hash'>;

export interface StageConfigRow {
  id: string;
  name: string;
  kind: StageKind;
  position: number;
}

export interface CategoryVerticalRow {
  category_id: string;
  category_name: string;
  vertical_id: string;
  vertical_name: string;
}

export interface FxRateRow {
  currency: string;
  name: string | null;
  rate_to_base: string;
  effective_from: string;
}

export async function findProfileWithPasswordByEmail(
  email: string,
): Promise<ProfileRecord | null> {
  const { rows } = await queryDb<ProfileRecord>(
    `SELECT id, email, password_hash, full_name, role, team_id, is_pse, is_active, created_at
     FROM profiles
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

/** Failed attempts for this email in the last `windowMinutes`. */
export async function countRecentFailedLogins(
  email: string,
  windowMinutes: number,
): Promise<number> {
  const { rows } = await queryDb<{ n: string }>(
    `SELECT count(*)::text AS n
     FROM login_attempts
     WHERE email = lower($1)
       AND attempted_at > now() - make_interval(mins => $2::int)`,
    [email, windowMinutes],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function recordFailedLogin(email: string): Promise<void> {
  await queryDb(`INSERT INTO login_attempts (email) VALUES (lower($1))`, [email]);
  // Drop attempts older than a day to keep the table small.
  await queryDb(`DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 day'`);
}

export async function clearFailedLogins(email: string): Promise<void> {
  await queryDb(`DELETE FROM login_attempts WHERE email = lower($1)`, [email]);
}

export async function listAllProfiles(): Promise<PublicProfileRecord[]> {
  const { rows } = await queryDb<PublicProfileRecord>(
    `SELECT id, email, full_name, role, team_id, is_pse, is_active, created_at
     FROM profiles
     ORDER BY is_pse DESC, role ASC, full_name ASC`,
  );
  return rows;
}

export async function listPseTeamMembers(): Promise<PublicProfileRecord[]> {
  const { rows } = await queryDb<PublicProfileRecord>(
    `SELECT id, email, full_name, role, team_id, is_pse, is_active, created_at
     FROM profiles
     WHERE is_pse = true AND is_active = true
     ORDER BY full_name ASC`,
  );
  return rows;
}

export async function insertProfileAsAdmin(
  actorUserId: string,
  input: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: AppRole;
    isPse: boolean;
  },
): Promise<PublicProfileRecord> {
  return withUserTransaction(actorUserId, async (client) => {
    const { rows: teams } = await client.query<{ id: string }>(
      `SELECT id FROM teams LIMIT 1`,
    );
    const teamId = input.isPse && teams[0] ? teams[0].id : null;

    const { rows } = await client.query<PublicProfileRecord>(
      `INSERT INTO profiles (email, password_hash, full_name, role, team_id, is_pse, is_active)
       VALUES ($1, $2, $3, $4::app_role, $5, $6, true)
       RETURNING id, email, full_name, role, team_id, is_pse, is_active, created_at`,
      [input.email, input.passwordHash, input.fullName, input.role, teamId, input.isPse],
    );
    return rows[0];
  });
}

export async function updateProfileAsAdmin(
  actorUserId: string,
  input: {
    userId: string;
    role: AppRole;
    isPse: boolean;
    isActive: boolean;
  },
): Promise<PublicProfileRecord> {
  return withUserTransaction(actorUserId, async (client) => {
    const { rows } = await client.query<PublicProfileRecord>(
      `UPDATE profiles
       SET role = $2::app_role,
           is_pse = $3,
           is_active = $4,
           updated_at = now()
       WHERE id = $1
       RETURNING id, email, full_name, role, team_id, is_pse, is_active, created_at`,
      [input.userId, input.role, input.isPse, input.isActive],
    );
    if (!rows[0]) {
      throw new Error('User profile not found.');
    }
    return rows[0];
  });
}

export async function getReferenceConfigSummary(): Promise<{
  stages: StageConfigRow[];
  categoryMap: CategoryVerticalRow[];
  fxRates: FxRateRow[];
}> {
  const [stagesRes, catRes, fxRes] = await Promise.all([
    queryDb<StageConfigRow>(
      `SELECT id, name, kind, position
       FROM pipeline_stages
       ORDER BY position ASC`,
    ),
    queryDb<CategoryVerticalRow>(
      `SELECT c.id AS category_id, c.name AS category_name, v.id AS vertical_id, v.name AS vertical_name
       FROM contribution_categories c
       JOIN category_vertical_map m ON m.category_id = c.id
       JOIN verticals v ON v.id = m.vertical_id
       ORDER BY c.name ASC`,
    ),
    queryDb<FxRateRow>(
      `SELECT c.code AS currency, c.name, f.rate_to_base::text, f.effective_from::text
       FROM currencies c
       LEFT JOIN fx_rates f ON f.currency = c.code
       ORDER BY c.code ASC`,
    ),
  ]);

  return {
    stages: stagesRes.rows,
    categoryMap: catRes.rows,
    fxRates: fxRes.rows,
  };
}
