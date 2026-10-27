import { withUserTransaction } from '@/shared/lib/supabase/server';
import type {
  ActivityClass,
  ActivityStatus,
  ActivityType,
  AppRole,
  ContactType,
} from '@/types/database';
import type { ActivityFilters } from './schema';
import type { PreparedActivityPayload } from './service';

export interface ActivityOwnerOption {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
}

export interface ActivityListItem {
  id: string;
  title: string;
  type: ActivityType;
  class: ActivityClass;
  owner_id: string;
  owner_name: string;
  contact_id: string | null;
  effective_contact_id: string | null;
  contact_name: string | null;
  contact_type: ContactType | null;
  derived_org_name: string | null;
  pipeline_id: string | null;
  pipeline_deal_name: string | null;
  meeting_id: string | null;
  meeting_scheduled_at: string | null;
  related_org_name: string | null;
  status: ActivityStatus;
  remaining_work: string | null;
  occurred_at: string | null;
  due_at: string | null;
  notes: string | null;
  created_at: string;
}

export async function listActivities(
  userId: string,
  filters: ActivityFilters = {},
): Promise<ActivityListItem[]> {
  return withUserTransaction(userId, async (client) => {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.q) {
      params.push(`%${filters.q.trim()}%`);
      const idx = params.length;
      clauses.push(
        `(a.title ILIKE $${idx} OR COALESCE(a.related_org_name, '') ILIKE $${idx} OR COALESCE(a.remaining_work, '') ILIKE $${idx} OR COALESCE(a.notes, '') ILIKE $${idx} OR COALESCE(ct.name, '') ILIKE $${idx} OR COALESCE(p.deal_name, '') ILIKE $${idx})`,
      );
    }

    if (filters.type) {
      params.push(filters.type);
      clauses.push(`a.type = $${params.length}`);
    }

    if (filters.class) {
      params.push(filters.class);
      clauses.push(`a.class = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      clauses.push(`a.status = $${params.length}`);
    }

    if (filters.ownerId) {
      params.push(filters.ownerId);
      clauses.push(`a.owner_id = $${params.length}`);
    }

    if (filters.fromDate) {
      params.push(filters.fromDate);
      clauses.push(
        `COALESCE(a.occurred_at, a.due_at, a.created_at)::date >= $${params.length}::date`,
      );
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      clauses.push(
        `COALESCE(a.occurred_at, a.due_at, a.created_at)::date <= $${params.length}::date`,
      );
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const res = await client.query<ActivityListItem>(
      `SELECT
         a.id,
         a.title,
         a.type,
         a.class,
         a.owner_id,
         ow.full_name AS owner_name,
         a.contact_id,
         COALESCE(a.contact_id, p.contact_id) AS effective_contact_id,
         ct.name AS contact_name,
         ct.type AS contact_type,
         CASE
           WHEN ct.type = 'company' THEN ct.name
           ELSE org.name
         END AS derived_org_name,
         a.pipeline_id,
         p.deal_name AS pipeline_deal_name,
         a.meeting_id,
         m.scheduled_at::text AS meeting_scheduled_at,
         a.related_org_name,
         a.status,
         a.remaining_work,
         a.occurred_at::text,
         a.due_at::text,
         a.notes,
         a.created_at::text
       FROM activities a
       JOIN profiles ow ON ow.id = a.owner_id
       LEFT JOIN pipelines p ON p.id = a.pipeline_id
       LEFT JOIN contacts ct ON ct.id = COALESCE(a.contact_id, p.contact_id)
       LEFT JOIN contacts org ON org.id = ct.organization_id
       LEFT JOIN meetings m ON m.id = a.meeting_id
       ${whereSql}
       ORDER BY COALESCE(a.occurred_at, a.due_at, a.created_at) DESC, a.created_at DESC`,
      params,
    );

    return res.rows;
  });
}

export async function listActivityOwners(userId: string): Promise<ActivityOwnerOption[]> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<ActivityOwnerOption>(
      `SELECT id, full_name, email, role
       FROM profiles
       WHERE is_pse = true AND is_active = true
       ORDER BY full_name ASC`,
    );
    return res.rows;
  });
}

export async function createActivityRecord(
  userId: string,
  payload: PreparedActivityPayload,
): Promise<{ id: string }> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO activities (
         title,
         type,
         class,
         owner_id,
         contact_id,
         pipeline_id,
         meeting_id,
         related_org_name,
         status,
         remaining_work,
         occurred_at,
         due_at,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        payload.title,
        payload.type,
        payload.class,
        payload.owner_id,
        payload.contact_id,
        payload.pipeline_id,
        payload.meeting_id,
        payload.related_org_name,
        payload.status,
        payload.remaining_work,
        payload.occurred_at,
        payload.due_at,
        payload.notes,
      ],
    );

    return { id: res.rows[0].id };
  });
}

export async function updateActivityRecord(
  userId: string,
  activityId: string,
  payload: PreparedActivityPayload,
): Promise<{ id: string }> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{ id: string }>(
      `UPDATE activities
       SET title = $1,
           type = $2,
           class = $3,
           owner_id = $4,
           contact_id = $5,
           pipeline_id = $6,
           meeting_id = $7,
           related_org_name = $8,
           status = $9,
           remaining_work = $10,
           occurred_at = $11,
           due_at = $12,
           notes = $13
       WHERE id = $14
       RETURNING id`,
      [
        payload.title,
        payload.type,
        payload.class,
        payload.owner_id,
        payload.contact_id,
        payload.pipeline_id,
        payload.meeting_id,
        payload.related_org_name,
        payload.status,
        payload.remaining_work,
        payload.occurred_at,
        payload.due_at,
        payload.notes,
        activityId,
      ],
    );

    if (res.rowCount === 0) {
      throw new Error('Activity not found or you do not have permission to edit it.');
    }

    return { id: res.rows[0].id };
  });
}

export async function updateActivityStatusRecord(
  userId: string,
  activityId: string,
  status: ActivityStatus,
): Promise<{ id: string }> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{ id: string }>(
      `UPDATE activities
       SET status = $1
       WHERE id = $2
       RETURNING id`,
      [status, activityId],
    );

    if (res.rowCount === 0) {
      throw new Error(
        'Activity not found or you do not have permission to update its status.',
      );
    }

    return { id: res.rows[0].id };
  });
}
