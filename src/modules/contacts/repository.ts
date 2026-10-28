import { withUserTransaction } from '@/shared/lib/supabase/server';
import type {
  ActivityClass,
  ActivityStatus,
  ActivityType,
  ChannelKind,
  ContactStatus,
  ContactType,
  ContributionType,
  MeetingStatus,
  StageKind,
} from '@/types/database';
import type { ContactFilters } from './schema';
import type { NormalizedChannel, PreparedContactPayload } from './service';

export interface ContactChannelRow {
  id: string;
  contact_id: string;
  kind: ChannelKind;
  value: string;
  value_normalized: string;
  is_primary: boolean;
}

export interface ContactListItem {
  id: string;
  type: ContactType;
  name: string;
  organization_id: string | null;
  organization_name: string | null;
  designation: string | null;
  website: string | null;
  industry: string | null;
  status: ContactStatus;
  owner_id: string | null;
  owner_name: string | null;
  primary_channel_kind: ChannelKind | null;
  primary_channel_value: string | null;
  channel_count: number;
  created_at: string;
}

export interface DuplicateContactMatch {
  id: string;
  name: string;
  type: ContactType;
  matched_kind: ChannelKind;
  matched_value: string;
}

export interface ContactLiteOption {
  id: string;
  name: string;
  type: ContactType;
  organization_id: string | null;
  organization_name: string | null;
  designation: string | null;
  primary_channel: string | null;
}

export interface RelatedPipelineRow {
  id: string;
  deal_name: string;
  contribution_type: ContributionType;
  stage_name: string;
  stage_kind: StageKind;
  expected_amount: number;
  currency: string;
  amount_base: number;
  expected_close: string | null;
  focal_person_name: string;
  role_in_deal: 'Primary Donor' | 'Point of Contact' | 'Secondary Contact';
}

export interface RelatedMeetingRow {
  id: string;
  scheduled_at: string;
  status: MeetingStatus;
  description: string | null;
  owner_name: string;
  pipeline_name: string | null;
}

export interface RelatedActivityRow {
  id: string;
  type: ActivityType;
  class: ActivityClass;
  title: string;
  status: ActivityStatus;
  occurred_at: string | null;
  due_at: string | null;
  owner_name: string;
}

export interface AffiliatedIndividualRow {
  id: string;
  name: string;
  designation: string | null;
  status: ContactStatus;
  primary_channel: string | null;
}

export interface ContactDetailData {
  id: string;
  type: ContactType;
  name: string;
  organization_id: string | null;
  organization_name: string | null;
  designation: string | null;
  website: string | null;
  industry: string | null;
  notes: string | null;
  status: ContactStatus;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
  channels: ContactChannelRow[];
  affiliatedIndividuals: AffiliatedIndividualRow[];
  pipelines: RelatedPipelineRow[];
  meetings: RelatedMeetingRow[];
  activities: RelatedActivityRow[];
}

export async function listContacts(
  userId: string,
  filters: ContactFilters = {},
): Promise<ContactListItem[]> {
  return withUserTransaction(userId, async (client) => {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.type) {
      params.push(filters.type);
      conditions.push(`c.type = $${params.length}::contact_type`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (filters.organizationId) {
      params.push(filters.organizationId);
      conditions.push(`c.organization_id = $${params.length}::uuid`);
    }

    if (filters.industry) {
      params.push(filters.industry);
      conditions.push(`lower(c.industry) = lower($${params.length})`);
    }

    if (filters.q && filters.q.trim()) {
      params.push(`%${filters.q.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(
          c.name ILIKE $${idx}
          OR COALESCE(c.designation, '') ILIKE $${idx}
          OR COALESCE(c.industry, '') ILIKE $${idx}
          OR COALESCE(org.name, '') ILIKE $${idx}
          OR EXISTS (
            SELECT 1 FROM contact_channels ch_search
            WHERE ch_search.contact_id = c.id
              AND (ch_search.value ILIKE $${idx} OR ch_search.value_normalized ILIKE $${idx})
          )
        )`,
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await client.query<ContactListItem>(
      `SELECT
         c.id,
         c.type,
         c.name,
         c.organization_id,
         org.name AS organization_name,
         c.designation,
         c.website,
         c.industry,
         c.status,
         c.owner_id,
         p.full_name AS owner_name,
         pch.kind AS primary_channel_kind,
         pch.value AS primary_channel_value,
         COALESCE(ch_cnt.cnt, 0)::int AS channel_count,
         c.created_at::text
       FROM contacts c
       LEFT JOIN contacts org ON org.id = c.organization_id
       LEFT JOIN profiles p ON p.id = c.owner_id
       LEFT JOIN LATERAL (
         SELECT kind, value
         FROM contact_channels
         WHERE contact_id = c.id
         ORDER BY is_primary DESC, id ASC
         LIMIT 1
       ) pch ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS cnt
         FROM contact_channels
         WHERE contact_id = c.id
       ) ch_cnt ON true
       ${whereClause}
       ORDER BY c.created_at DESC, c.name ASC`,
      params,
    );

    return rows;
  });
}

export async function findByNormalizedChannels(
  userId: string,
  channels: NormalizedChannel[],
  excludeContactId?: string,
): Promise<DuplicateContactMatch | null> {
  if (channels.length === 0) return null;

  return withUserTransaction(userId, async (client) => {
    for (const ch of channels) {
      const params: unknown[] = [ch.kind, ch.value_normalized];
      let excludeClause = '';
      if (excludeContactId) {
        params.push(excludeContactId);
        excludeClause = `AND c.id <> $3::uuid`;
      }

      const { rows } = await client.query<DuplicateContactMatch>(
        `SELECT
           c.id,
           c.name,
           c.type,
           ch.kind AS matched_kind,
           ch.value AS matched_value
         FROM contact_channels ch
         JOIN contacts c ON c.id = ch.contact_id
         WHERE ch.kind = $1::channel_kind
           AND ch.value_normalized = $2
           ${excludeClause}
         LIMIT 1`,
        params,
      );

      if (rows[0]) {
        return rows[0];
      }
    }

    return null;
  });
}

export async function createContactRecord(
  userId: string,
  payload: PreparedContactPayload,
): Promise<{ id: string; name: string; type: ContactType }> {
  return withUserTransaction(userId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      name: string;
      type: ContactType;
    }>(
      `INSERT INTO contacts (
         type, name, organization_id, designation, website, industry, notes, status, owner_id
       )
       VALUES ($1::contact_type, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, type`,
      [
        payload.type,
        payload.name,
        payload.organization_id,
        payload.designation,
        payload.website,
        payload.industry,
        payload.notes,
        payload.status,
        userId,
      ],
    );

    const contact = rows[0];

    for (const ch of payload.channels) {
      await client.query(
        `INSERT INTO contact_channels (contact_id, kind, value, value_normalized, is_primary)
         VALUES ($1, $2::channel_kind, $3, $4, $5)`,
        [contact.id, ch.kind, ch.value, ch.value_normalized, ch.is_primary],
      );
    }

    return contact;
  });
}

export async function updateContactRecord(
  userId: string,
  contactId: string,
  payload: PreparedContactPayload,
): Promise<{ id: string; name: string; type: ContactType }> {
  return withUserTransaction(userId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      name: string;
      type: ContactType;
    }>(
      `UPDATE contacts
       SET type = $2::contact_type,
           name = $3,
           organization_id = $4,
           designation = $5,
           website = $6,
           industry = $7,
           notes = $8,
           status = $9,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, type`,
      [
        contactId,
        payload.type,
        payload.name,
        payload.organization_id,
        payload.designation,
        payload.website,
        payload.industry,
        payload.notes,
        payload.status,
      ],
    );

    if (!rows[0]) {
      throw new Error('Contact not found or you do not have permission to edit it.');
    }

    // Replace channels inside the deferred constraint transaction
    await client.query(`DELETE FROM contact_channels WHERE contact_id = $1`, [contactId]);

    for (const ch of payload.channels) {
      await client.query(
        `INSERT INTO contact_channels (contact_id, kind, value, value_normalized, is_primary)
         VALUES ($1, $2::channel_kind, $3, $4, $5)`,
        [contactId, ch.kind, ch.value, ch.value_normalized, ch.is_primary],
      );
    }

    return rows[0];
  });
}

export async function getContactDetail(
  userId: string,
  contactId: string,
): Promise<ContactDetailData | null> {
  return withUserTransaction(userId, async (client) => {
    const { rows } = await client.query<
      Omit<
        ContactDetailData,
        'channels' | 'affiliatedIndividuals' | 'pipelines' | 'meetings' | 'activities'
      >
    >(
      `SELECT
         c.id,
         c.type,
         c.name,
         c.organization_id,
         org.name AS organization_name,
         c.designation,
         c.website,
         c.industry,
         c.notes,
         c.status,
         c.owner_id,
         p.full_name AS owner_name,
         c.created_at::text,
         c.updated_at::text
       FROM contacts c
       LEFT JOIN contacts org ON org.id = c.organization_id
       LEFT JOIN profiles p ON p.id = c.owner_id
       WHERE c.id = $1
       LIMIT 1`,
      [contactId],
    );

    const base = rows[0];
    if (!base) return null;

    const channelsRes = await client.query<ContactChannelRow>(
      `SELECT id, contact_id, kind, value, value_normalized, is_primary
       FROM contact_channels
       WHERE contact_id = $1
       ORDER BY is_primary DESC, kind ASC, value ASC`,
      [contactId],
    );
    const individualsRes = await client.query<AffiliatedIndividualRow>(
      `SELECT
         ind.id,
         ind.name,
         ind.designation,
         ind.status,
         pch.value AS primary_channel
       FROM contacts ind
       LEFT JOIN LATERAL (
         SELECT value
         FROM contact_channels
         WHERE contact_id = ind.id
         ORDER BY is_primary DESC, id ASC
         LIMIT 1
       ) pch ON true
       WHERE ind.organization_id = $1
       ORDER BY ind.name ASC`,
      [contactId],
    );
    const pipelinesRes = await client.query<{
      id: string;
      deal_name: string;
      contribution_type: ContributionType;
      stage_name: string;
      stage_kind: StageKind;
      expected_amount: string;
      currency: string;
      amount_base: string;
      expected_close: string | null;
      focal_person_name: string;
      role_in_deal: 'Primary Donor' | 'Point of Contact' | 'Secondary Contact';
    }>(
      `SELECT
         pl.id,
         pl.deal_name,
         pl.contribution_type,
         s.name AS stage_name,
         s.kind AS stage_kind,
         pl.expected_amount::text,
         pl.currency,
         pl.amount_base::text,
         pl.expected_close::text,
         fp.full_name AS focal_person_name,
         CASE
           WHEN pl.contact_id = $1 THEN 'Primary Donor'
           WHEN pl.poc_contact_id = $1 THEN 'Point of Contact'
           ELSE 'Secondary Contact'
         END AS role_in_deal
       FROM pipelines pl
       JOIN pipeline_stages s ON s.id = pl.stage_id
       JOIN profiles fp ON fp.id = pl.focal_person_id
       WHERE pl.contact_id = $1
          OR pl.poc_contact_id = $1
          OR pl.secondary_contact_id = $1
       ORDER BY pl.created_at DESC`,
      [contactId],
    );
    const meetingsRes = await client.query<RelatedMeetingRow>(
      `SELECT
         m.id,
         m.scheduled_at::text,
         m.status,
         m.description,
         pr.full_name AS owner_name,
         pl.deal_name AS pipeline_name
       FROM meetings m
       JOIN profiles pr ON pr.id = m.owner_id
       LEFT JOIN pipelines pl ON pl.id = m.pipeline_id
       WHERE m.contact_id = $1
       ORDER BY m.scheduled_at DESC`,
      [contactId],
    );
    const activitiesRes = await client.query<RelatedActivityRow>(
      `SELECT
         a.id,
         a.type,
         a.class,
         a.title,
         a.status,
         a.occurred_at::text,
         a.due_at::text,
         pr.full_name AS owner_name
       FROM activities a
       JOIN profiles pr ON pr.id = a.owner_id
       WHERE a.contact_id = $1
       ORDER BY COALESCE(a.occurred_at, a.due_at, a.created_at) DESC`,
      [contactId],
    );

    return {
      ...base,
      channels: channelsRes.rows,
      affiliatedIndividuals: individualsRes.rows,
      pipelines: pipelinesRes.rows.map((r) => ({
        ...r,
        expected_amount: Number(r.expected_amount),
        amount_base: Number(r.amount_base),
      })),
      meetings: meetingsRes.rows,
      activities: activitiesRes.rows,
    };
  });
}

export async function searchContactsLite(
  userId: string,
  q = '',
  allowedType?: ContactType,
): Promise<ContactLiteOption[]> {
  return withUserTransaction(userId, async (client) => {
    const conditions: string[] = [`c.status = 'active'`];
    const params: unknown[] = [];

    if (allowedType) {
      params.push(allowedType);
      conditions.push(`c.type = $${params.length}::contact_type`);
    }

    if (q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(c.name ILIKE $${idx} OR COALESCE(org.name, '') ILIKE $${idx} OR COALESCE(c.designation, '') ILIKE $${idx})`,
      );
    }

    const { rows } = await client.query<ContactLiteOption>(
      `SELECT
         c.id,
         c.name,
         c.type,
         c.organization_id,
         org.name AS organization_name,
         c.designation,
         pch.value AS primary_channel
       FROM contacts c
       LEFT JOIN contacts org ON org.id = c.organization_id
       LEFT JOIN LATERAL (
         SELECT value
         FROM contact_channels
         WHERE contact_id = c.id
         ORDER BY is_primary DESC, id ASC
         LIMIT 1
       ) pch ON true
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name ASC
       LIMIT 50`,
      params,
    );

    return rows;
  });
}

export async function listFilterMetadata(userId: string): Promise<{
  companies: { id: string; name: string }[];
  industries: string[];
}> {
  return withUserTransaction(userId, async (client) => {
    const compRes = await client.query<{ id: string; name: string }>(
      `SELECT id, name
       FROM contacts
       WHERE type = 'company'
       ORDER BY name ASC`,
    );
    const indRes = await client.query<{ industry: string }>(
      `SELECT DISTINCT btrim(industry) AS industry
       FROM contacts
       WHERE industry IS NOT NULL AND btrim(industry) <> ''
       ORDER BY industry ASC`,
    );

    return {
      companies: compRes.rows,
      industries: indRes.rows.map((r) => r.industry),
    };
  });
}
