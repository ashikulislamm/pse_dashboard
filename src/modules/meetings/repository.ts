import { withUserTransaction } from '@/shared/lib/supabase/server';
import type { AppRole, ContactType, MeetingStatus, StageKind } from '@/types/database';
import type { MeetingFilters } from './schema';
import type { PreparedMeetingPayload } from './service';

export interface MeetingOwnerOption {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
}

export interface MeetingListItem {
  id: string;
  contact_id: string | null;
  effective_contact_id: string | null;
  contact_name: string | null;
  contact_type: ContactType | null;
  derived_organization_name: string | null;
  derived_designation: string | null;
  pipeline_id: string | null;
  pipeline_deal_name: string | null;
  pipeline_stage_name: string | null;
  pipeline_stage_kind: StageKind | null;
  scheduled_at: string;
  status: MeetingStatus;
  description: string | null;
  owner_id: string;
  owner_name: string;
  created_at: string;
  followup_count: number;
}

export interface MeetingLiteOption {
  id: string;
  scheduled_at: string;
  status: MeetingStatus;
  contact_id: string | null;
  contact_name: string | null;
  pipeline_id: string | null;
  pipeline_deal_name: string | null;
  description: string | null;
}

/** Lists meetings with optional filters. Contact details come from the linked contact or the pipeline's contact. */
export async function listMeetings(
  userId: string,
  filters: MeetingFilters = {},
): Promise<MeetingListItem[]> {
  return withUserTransaction(userId, async (client) => {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.q) {
      params.push(`%${filters.q.trim()}%`);
      const idx = params.length;
      clauses.push(
        `(COALESCE(m.description, '') ILIKE $${idx} OR COALESCE(ct.name, '') ILIKE $${idx} OR COALESCE(org.name, '') ILIKE $${idx} OR COALESCE(p.deal_name, '') ILIKE $${idx})`,
      );
    }

    if (filters.status) {
      params.push(filters.status);
      clauses.push(`m.status = $${params.length}`);
    }

    if (filters.ownerId) {
      params.push(filters.ownerId);
      clauses.push(`m.owner_id = $${params.length}`);
    }

    if (filters.fromDate) {
      params.push(filters.fromDate);
      clauses.push(`m.scheduled_at::date >= $${params.length}::date`);
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      clauses.push(`m.scheduled_at::date <= $${params.length}::date`);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const res = await client.query<MeetingListItem>(
      `SELECT
         m.id,
         m.contact_id,
         COALESCE(m.contact_id, p.contact_id) AS effective_contact_id,
         ct.name AS contact_name,
         ct.type AS contact_type,
         CASE
           WHEN ct.type = 'company' THEN ct.name
           ELSE org.name
         END AS derived_organization_name,
         COALESCE(ct.designation, poc.designation) AS derived_designation,
         m.pipeline_id,
         p.deal_name AS pipeline_deal_name,
         s.name AS pipeline_stage_name,
         s.kind AS pipeline_stage_kind,
         m.scheduled_at::text,
         m.status,
         m.description,
         m.owner_id,
         ow.full_name AS owner_name,
         m.created_at::text,
         COALESCE(fa.followup_count, 0)::int AS followup_count
       FROM meetings m
       JOIN profiles ow ON ow.id = m.owner_id
       LEFT JOIN pipelines p ON p.id = m.pipeline_id
       LEFT JOIN pipeline_stages s ON s.id = p.stage_id
       LEFT JOIN contacts ct ON ct.id = COALESCE(m.contact_id, p.contact_id)
       LEFT JOIN contacts org ON org.id = ct.organization_id
       LEFT JOIN contacts poc ON poc.id = p.poc_contact_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS followup_count
         FROM activities a
         WHERE a.meeting_id = m.id
       ) fa ON true
       ${whereSql}
       ORDER BY m.scheduled_at DESC, m.created_at DESC`,
      params,
    );

    return res.rows;
  });
}

export async function listMeetingOwners(userId: string): Promise<MeetingOwnerOption[]> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<MeetingOwnerOption>(
      `SELECT id, full_name, email, role
       FROM profiles
       WHERE is_pse = true AND is_active = true
       ORDER BY full_name ASC`,
    );
    return res.rows;
  });
}

export async function createMeetingRecord(
  userId: string,
  payload: PreparedMeetingPayload,
): Promise<{ id: string }> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO meetings (
         contact_id,
         pipeline_id,
         scheduled_at,
         status,
         description,
         owner_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        payload.contact_id,
        payload.pipeline_id,
        payload.scheduled_at,
        payload.status,
        payload.description,
        payload.owner_id,
      ],
    );

    return { id: res.rows[0].id };
  });
}

export async function updateMeetingRecord(
  userId: string,
  meetingId: string,
  payload: PreparedMeetingPayload,
): Promise<{ id: string }> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{ id: string }>(
      `UPDATE meetings
       SET contact_id = $1,
           pipeline_id = $2,
           scheduled_at = $3,
           status = $4,
           description = $5,
           owner_id = $6
       WHERE id = $7
       RETURNING id`,
      [
        payload.contact_id,
        payload.pipeline_id,
        payload.scheduled_at,
        payload.status,
        payload.description,
        payload.owner_id,
        meetingId,
      ],
    );

    if (res.rowCount === 0) {
      throw new Error('Meeting not found or you do not have permission to edit it.');
    }

    return { id: res.rows[0].id };
  });
}

export async function updateMeetingStatusRecord(
  userId: string,
  meetingId: string,
  status: MeetingStatus,
): Promise<{ id: string }> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{ id: string }>(
      `UPDATE meetings
       SET status = $1
       WHERE id = $2
       RETURNING id`,
      [status, meetingId],
    );

    if (res.rowCount === 0) {
      throw new Error('Meeting not found or you do not have permission to update its status.');
    }

    return { id: res.rows[0].id };
  });
}

export async function listMeetingsLite(userId: string): Promise<MeetingLiteOption[]> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<MeetingLiteOption>(
      `SELECT
         m.id,
         m.scheduled_at::text,
         m.status,
         COALESCE(m.contact_id, p.contact_id) AS contact_id,
         ct.name AS contact_name,
         m.pipeline_id,
         p.deal_name AS pipeline_deal_name,
         m.description
       FROM meetings m
       LEFT JOIN pipelines p ON p.id = m.pipeline_id
       LEFT JOIN contacts ct ON ct.id = COALESCE(m.contact_id, p.contact_id)
       ORDER BY m.scheduled_at DESC
       LIMIT 100`,
    );
    return res.rows;
  });
}
