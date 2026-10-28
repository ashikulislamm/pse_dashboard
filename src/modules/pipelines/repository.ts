import { queryDb } from '@/shared/lib/supabase/admin';
import { withUserTransaction } from '@/shared/lib/supabase/server';
import type {
  ActivityClass,
  ActivityStatus,
  ActivityType,
  AppRole,
  ContactType,
  ContributionType,
  MeetingStatus,
  PartyType,
  PaymentInterval,
  StageKind,
} from '@/types/database';
import type { PipelineFilters, RecordReceiptInput } from './schema';
import {
  canMoveToKind,
  computeBase,
  validateReceiptAllowed,
  type FxRateOption,
  type PreparedPipelinePayload,
  type StageOption,
} from './service';

export interface CategoryOption {
  id: string;
  name: string;
  vertical_id: string;
  vertical_name: string;
}

export interface CurrencyOption {
  code: string;
  name: string | null;
}

export interface FocalPersonOption {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
}

export interface PipelineReferenceData {
  stages: StageOption[];
  categories: CategoryOption[];
  currencies: CurrencyOption[];
  fxRates: FxRateOption[];
  focalPeople: FocalPersonOption[];
}

export interface PipelineListItem {
  id: string;
  deal_name: string;
  focal_person_id: string;
  focal_person_name: string;
  contribution_type: ContributionType;
  category_id: string;
  category_name: string;
  vertical_name: string;
  party_type: PartyType;
  contact_id: string;
  contact_name: string;
  contact_type: ContactType;
  poc_contact_id: string | null;
  poc_contact_name: string | null;
  secondary_contact_id: string | null;
  secondary_contact_name: string | null;
  stage_id: string;
  stage_name: string;
  stage_kind: StageKind;
  stage_position: number;
  expected_amount: number;
  currency: string;
  amount_base: number;
  payment_interval: PaymentInterval;
  expected_close: string | null;
  country: string | null;
  description: string | null;
  operational_budget: number | null;
  notes: string | null;
  in_kind_valuation_note: string | null;
  lost_reason: string | null;
  won_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  receipt_count: number;
  received_amount_base: number;
}

export interface PipelineStageHistoryRow {
  id: number;
  pipeline_id: string;
  from_stage: string | null;
  from_stage_name: string | null;
  to_stage: string;
  to_stage_name: string;
  to_stage_kind: StageKind;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

export interface PipelineReceiptRow {
  id: string;
  pipeline_id: string;
  amount: number;
  currency: string;
  amount_base: number;
  received_on: string;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface PipelineRelatedMeeting {
  id: string;
  scheduled_at: string;
  status: MeetingStatus;
  description: string | null;
  owner_name: string;
  contact_name: string | null;
}

export interface PipelineRelatedActivity {
  id: string;
  title: string;
  type: ActivityType;
  class: ActivityClass;
  status: ActivityStatus;
  occurred_at: string | null;
  due_at: string | null;
  owner_name: string;
  remaining_work: string | null;
}

export interface PipelineDetailData {
  pipeline: PipelineListItem & {
    created_by_name: string | null;
    contact_organization_name: string | null;
    contact_designation: string | null;
    poc_designation: string | null;
    secondary_designation: string | null;
  };
  stageHistory: PipelineStageHistoryRow[];
  receipts: PipelineReceiptRow[];
  meetings: PipelineRelatedMeeting[];
  activities: PipelineRelatedActivity[];
}

export interface PipelineLiteOption {
  id: string;
  deal_name: string;
  contact_id: string;
  contact_name: string;
  stage_name: string;
  stage_kind: StageKind;
  amount_base: number;
}

/** Lookup data for forms: stages, categories with verticals, currencies, FX rates, focal people. Authorise with requireUser() first. */
export async function fetchPipelineReferenceData(): Promise<PipelineReferenceData> {
  const [stagesRes, categoriesRes, currenciesRes, fxRes, peopleRes] = await Promise.all([
    queryDb<StageOption>(
      `SELECT id, name, kind, position
       FROM pipeline_stages
       ORDER BY position ASC`,
    ),
    queryDb<CategoryOption>(
      `SELECT
         c.id,
         c.name,
         v.id AS vertical_id,
         v.name AS vertical_name
       FROM contribution_categories c
       JOIN category_vertical_map m ON m.category_id = c.id
       JOIN verticals v ON v.id = m.vertical_id
       ORDER BY c.name ASC`,
    ),
    queryDb<CurrencyOption>(
      `SELECT code, name
       FROM currencies
       ORDER BY CASE WHEN code = 'BDT' THEN 0 ELSE 1 END, code ASC`,
    ),
    queryDb<{ currency: string; rate_to_base: string; effective_from: string }>(
      `SELECT
         currency,
         rate_to_base::text,
         effective_from::text
       FROM fx_rates
       ORDER BY effective_from DESC`,
    ),
    queryDb<FocalPersonOption>(
      `SELECT id, full_name, email, role
       FROM profiles
       WHERE is_pse = true AND is_active = true
       ORDER BY full_name ASC`,
    ),
  ]);

  return {
    stages: stagesRes.rows,
    categories: categoriesRes.rows,
    currencies: currenciesRes.rows,
    fxRates: fxRes.rows.map((r) => ({
      currency: r.currency,
      rate_to_base: Number(r.rate_to_base),
      effective_from: r.effective_from,
    })),
    focalPeople: peopleRes.rows,
  };
}

/** Same lookup data as above, read inside the user's transaction. */
export async function listPipelineReferenceData(
  userId: string,
): Promise<PipelineReferenceData> {
  return withUserTransaction(userId, async (client) => {
    const [stagesRes, categoriesRes, currenciesRes, fxRes, peopleRes] = await Promise.all([
      client.query<StageOption>(
        `SELECT id, name, kind, position
         FROM pipeline_stages
         ORDER BY position ASC`,
      ),
      client.query<CategoryOption>(
        `SELECT
           c.id,
           c.name,
           v.id AS vertical_id,
           v.name AS vertical_name
         FROM contribution_categories c
         JOIN category_vertical_map m ON m.category_id = c.id
         JOIN verticals v ON v.id = m.vertical_id
         ORDER BY c.name ASC`,
      ),
      client.query<CurrencyOption>(
        `SELECT code, name
         FROM currencies
         ORDER BY CASE WHEN code = 'BDT' THEN 0 ELSE 1 END, code ASC`,
      ),
      client.query<{ currency: string; rate_to_base: string; effective_from: string }>(
        `SELECT
           currency,
           rate_to_base::text,
           effective_from::text
         FROM fx_rates
         ORDER BY effective_from DESC`,
      ),
      client.query<FocalPersonOption>(
        `SELECT id, full_name, email, role
         FROM profiles
         WHERE is_pse = true AND is_active = true
         ORDER BY full_name ASC`,
      ),
    ]);

    return {
      stages: stagesRes.rows,
      categories: categoriesRes.rows,
      currencies: currenciesRes.rows,
      fxRates: fxRes.rows.map((r) => ({
        currency: r.currency,
        rate_to_base: Number(r.rate_to_base),
        effective_from: r.effective_from,
      })),
      focalPeople: peopleRes.rows,
    };
  });
}

/** Lists pipelines with optional filters, including stage, vertical, contacts and receipt totals. */
export async function listPipelines(
  userId: string,
  filters: PipelineFilters = {},
): Promise<PipelineListItem[]> {
  return withUserTransaction(userId, async (client) => {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.q) {
      params.push(`%${filters.q.trim()}%`);
      const idx = params.length;
      clauses.push(
        `(p.deal_name ILIKE $${idx} OR ct.name ILIKE $${idx} OR poc.name ILIKE $${idx} OR COALESCE(p.notes, '') ILIKE $${idx})`,
      );
    }

    if (filters.stageId) {
      params.push(filters.stageId);
      clauses.push(`p.stage_id = $${params.length}`);
    }

    if (filters.stageKind) {
      params.push(filters.stageKind);
      clauses.push(`s.kind = $${params.length}`);
    }

    if (filters.categoryId) {
      params.push(filters.categoryId);
      clauses.push(`p.category_id = $${params.length}`);
    }

    if (filters.focalPersonId) {
      params.push(filters.focalPersonId);
      clauses.push(`p.focal_person_id = $${params.length}`);
    }

    if (filters.partyType) {
      params.push(filters.partyType);
      clauses.push(`p.party_type = $${params.length}`);
    }

    if (filters.contributionType) {
      params.push(filters.contributionType);
      clauses.push(`p.contribution_type = $${params.length}`);
    }

    if (filters.fromDate) {
      params.push(filters.fromDate);
      clauses.push(`COALESCE(p.expected_close, p.created_at::date) >= $${params.length}::date`);
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      clauses.push(`COALESCE(p.expected_close, p.created_at::date) <= $${params.length}::date`);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const res = await client.query<{
      id: string;
      deal_name: string;
      focal_person_id: string;
      focal_person_name: string;
      contribution_type: ContributionType;
      category_id: string;
      category_name: string;
      vertical_name: string;
      party_type: PartyType;
      contact_id: string;
      contact_name: string;
      contact_type: ContactType;
      poc_contact_id: string | null;
      poc_contact_name: string | null;
      secondary_contact_id: string | null;
      secondary_contact_name: string | null;
      stage_id: string;
      stage_name: string;
      stage_kind: StageKind;
      stage_position: number;
      expected_amount: string;
      currency: string;
      amount_base: string;
      payment_interval: PaymentInterval;
      expected_close: string | null;
      country: string | null;
      description: string | null;
      operational_budget: string | null;
      notes: string | null;
      in_kind_valuation_note: string | null;
      lost_reason: string | null;
      won_at: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
      receipt_count: number;
      received_amount_base: string;
    }>(
      `SELECT
         p.id,
         p.deal_name,
         p.focal_person_id,
         fp.full_name AS focal_person_name,
         p.contribution_type,
         p.category_id,
         cat.name AS category_name,
         vert.name AS vertical_name,
         p.party_type,
         p.contact_id,
         ct.name AS contact_name,
         ct.type AS contact_type,
         p.poc_contact_id,
         poc.name AS poc_contact_name,
         p.secondary_contact_id,
         sec.name AS secondary_contact_name,
         p.stage_id,
         s.name AS stage_name,
         s.kind AS stage_kind,
         s.position AS stage_position,
         p.expected_amount::text,
         p.currency,
         p.amount_base::text,
         p.payment_interval,
         p.expected_close::text,
         p.country,
         p.description,
         p.operational_budget::text,
         p.notes,
         p.in_kind_valuation_note,
         p.lost_reason,
         p.won_at::text,
         p.created_by,
         p.created_at::text,
         p.updated_at::text,
         COALESCE(rc.receipt_count, 0)::int AS receipt_count,
         COALESCE(rc.received_amount_base, 0)::text AS received_amount_base
       FROM pipelines p
       JOIN profiles fp ON fp.id = p.focal_person_id
       JOIN contribution_categories cat ON cat.id = p.category_id
       JOIN category_vertical_map cvm ON cvm.category_id = cat.id
       JOIN verticals vert ON vert.id = cvm.vertical_id
       JOIN contacts ct ON ct.id = p.contact_id
       LEFT JOIN contacts poc ON poc.id = p.poc_contact_id
       LEFT JOIN contacts sec ON sec.id = p.secondary_contact_id
       JOIN pipeline_stages s ON s.id = p.stage_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS receipt_count,
           COALESCE(SUM(r.amount_base), 0) AS received_amount_base
         FROM pipeline_receipts r
         WHERE r.pipeline_id = p.id
       ) rc ON true
       ${whereSql}
       ORDER BY p.updated_at DESC, p.created_at DESC`,
      params,
    );

    return res.rows.map((r) => ({
      ...r,
      expected_amount: Number(r.expected_amount),
      amount_base: Number(r.amount_base),
      operational_budget:
        r.operational_budget !== null ? Number(r.operational_budget) : null,
      received_amount_base: Number(r.received_amount_base),
    }));
  });
}

/** Full pipeline detail: stage history, receipts, linked meetings and activities. */
export async function getPipelineDetail(
  userId: string,
  pipelineId: string,
): Promise<PipelineDetailData | null> {
  return withUserTransaction(userId, async (client) => {
    const pipelineRes = await client.query<{
      id: string;
      deal_name: string;
      focal_person_id: string;
      focal_person_name: string;
      contribution_type: ContributionType;
      category_id: string;
      category_name: string;
      vertical_name: string;
      party_type: PartyType;
      contact_id: string;
      contact_name: string;
      contact_type: ContactType;
      contact_organization_name: string | null;
      contact_designation: string | null;
      poc_contact_id: string | null;
      poc_contact_name: string | null;
      poc_designation: string | null;
      secondary_contact_id: string | null;
      secondary_contact_name: string | null;
      secondary_designation: string | null;
      stage_id: string;
      stage_name: string;
      stage_kind: StageKind;
      stage_position: number;
      expected_amount: string;
      currency: string;
      amount_base: string;
      payment_interval: PaymentInterval;
      expected_close: string | null;
      country: string | null;
      description: string | null;
      operational_budget: string | null;
      notes: string | null;
      in_kind_valuation_note: string | null;
      lost_reason: string | null;
      won_at: string | null;
      created_by: string | null;
      created_by_name: string | null;
      created_at: string;
      updated_at: string;
      receipt_count: number;
      received_amount_base: string;
    }>(
      `SELECT
         p.id,
         p.deal_name,
         p.focal_person_id,
         fp.full_name AS focal_person_name,
         p.contribution_type,
         p.category_id,
         cat.name AS category_name,
         vert.name AS vertical_name,
         p.party_type,
         p.contact_id,
         ct.name AS contact_name,
         ct.type AS contact_type,
         org.name AS contact_organization_name,
         ct.designation AS contact_designation,
         p.poc_contact_id,
         poc.name AS poc_contact_name,
         poc.designation AS poc_designation,
         p.secondary_contact_id,
         sec.name AS secondary_contact_name,
         sec.designation AS secondary_designation,
         p.stage_id,
         s.name AS stage_name,
         s.kind AS stage_kind,
         s.position AS stage_position,
         p.expected_amount::text,
         p.currency,
         p.amount_base::text,
         p.payment_interval,
         p.expected_close::text,
         p.country,
         p.description,
         p.operational_budget::text,
         p.notes,
         p.in_kind_valuation_note,
         p.lost_reason,
         p.won_at::text,
         p.created_by,
         creator.full_name AS created_by_name,
         p.created_at::text,
         p.updated_at::text,
         COALESCE(rc.receipt_count, 0)::int AS receipt_count,
         COALESCE(rc.received_amount_base, 0)::text AS received_amount_base
       FROM pipelines p
       JOIN profiles fp ON fp.id = p.focal_person_id
       LEFT JOIN profiles creator ON creator.id = p.created_by
       JOIN contribution_categories cat ON cat.id = p.category_id
       JOIN category_vertical_map cvm ON cvm.category_id = cat.id
       JOIN verticals vert ON vert.id = cvm.vertical_id
       JOIN contacts ct ON ct.id = p.contact_id
       LEFT JOIN contacts org ON org.id = ct.organization_id
       LEFT JOIN contacts poc ON poc.id = p.poc_contact_id
       LEFT JOIN contacts sec ON sec.id = p.secondary_contact_id
       JOIN pipeline_stages s ON s.id = p.stage_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS receipt_count,
           COALESCE(SUM(r.amount_base), 0) AS received_amount_base
         FROM pipeline_receipts r
         WHERE r.pipeline_id = p.id
       ) rc ON true
       WHERE p.id = $1`,
      [pipelineId],
    );

    const row = pipelineRes.rows[0];
    if (!row) return null;

    const historyRes = await client.query<{
      id: string;
      pipeline_id: string;
      from_stage: string | null;
      from_stage_name: string | null;
      to_stage: string;
      to_stage_name: string;
      to_stage_kind: StageKind;
      changed_by: string | null;
      changed_by_name: string | null;
      changed_at: string;
    }>(
      `SELECT
         h.id::text,
         h.pipeline_id,
         h.from_stage,
         fs.name AS from_stage_name,
         h.to_stage,
         ts.name AS to_stage_name,
         ts.kind AS to_stage_kind,
         h.changed_by,
         pr.full_name AS changed_by_name,
         h.changed_at::text
       FROM pipeline_stage_history h
       LEFT JOIN pipeline_stages fs ON fs.id = h.from_stage
       JOIN pipeline_stages ts ON ts.id = h.to_stage
       LEFT JOIN profiles pr ON pr.id = h.changed_by
       WHERE h.pipeline_id = $1
       ORDER BY h.changed_at DESC, h.id DESC`,
      [pipelineId],
    );
    const receiptsRes = await client.query<{
      id: string;
      pipeline_id: string;
      amount: string;
      currency: string;
      amount_base: string;
      received_on: string;
      note: string | null;
      created_by: string | null;
      created_by_name: string | null;
      created_at: string;
    }>(
      `SELECT
         r.id,
         r.pipeline_id,
         r.amount::text,
         r.currency,
         r.amount_base::text,
         r.received_on::text,
         r.note,
         r.created_by,
         pr.full_name AS created_by_name,
         r.created_at::text
       FROM pipeline_receipts r
       LEFT JOIN profiles pr ON pr.id = r.created_by
       WHERE r.pipeline_id = $1
       ORDER BY r.received_on DESC, r.created_at DESC`,
      [pipelineId],
    );
    const meetingsRes = await client.query<PipelineRelatedMeeting>(
      `SELECT
         m.id,
         m.scheduled_at::text,
         m.status,
         m.description,
         pr.full_name AS owner_name,
         c.name AS contact_name
       FROM meetings m
       JOIN profiles pr ON pr.id = m.owner_id
       LEFT JOIN contacts c ON c.id = m.contact_id
       WHERE m.pipeline_id = $1
       ORDER BY m.scheduled_at DESC`,
      [pipelineId],
    );
    const activitiesRes = await client.query<PipelineRelatedActivity>(
      `SELECT
         a.id,
         a.title,
         a.type,
         a.class,
         a.status,
         a.occurred_at::text,
         a.due_at::text,
         pr.full_name AS owner_name,
         a.remaining_work
       FROM activities a
       JOIN profiles pr ON pr.id = a.owner_id
       WHERE a.pipeline_id = $1
       ORDER BY COALESCE(a.occurred_at, a.due_at, a.created_at) DESC`,
      [pipelineId],
    );

    return {
      pipeline: {
        ...row,
        expected_amount: Number(row.expected_amount),
        amount_base: Number(row.amount_base),
        operational_budget:
          row.operational_budget !== null ? Number(row.operational_budget) : null,
        received_amount_base: Number(row.received_amount_base),
      },
      stageHistory: historyRes.rows.map((h) => ({
        ...h,
        id: Number(h.id),
      })),
      receipts: receiptsRes.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
        amount_base: Number(r.amount_base),
      })),
      meetings: meetingsRes.rows,
      activities: activitiesRes.rows,
    };
  });
}

/** Inserts a pipeline. The DB trigger records the first stage history row. */
export async function createPipelineRecord(
  userId: string,
  payload: PreparedPipelinePayload,
): Promise<{ id: string }> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO pipelines (
         deal_name,
         focal_person_id,
         contribution_type,
         category_id,
         party_type,
         contact_id,
         poc_contact_id,
         secondary_contact_id,
         stage_id,
         expected_amount,
         currency,
         amount_base,
         payment_interval,
         expected_close,
         country,
         description,
         operational_budget,
         notes,
         in_kind_valuation_note,
         lost_reason,
         created_by
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
       )
       RETURNING id`,
      [
        payload.deal_name,
        payload.focal_person_id,
        payload.contribution_type,
        payload.category_id,
        payload.party_type,
        payload.contact_id,
        payload.poc_contact_id,
        payload.secondary_contact_id,
        payload.stage_id,
        payload.expected_amount,
        payload.currency,
        payload.amount_base,
        payload.payment_interval,
        payload.expected_close,
        payload.country,
        payload.description,
        payload.operational_budget,
        payload.notes,
        payload.in_kind_valuation_note,
        payload.lost_reason,
        userId,
      ],
    );

    return { id: res.rows[0].id };
  });
}

/** Updates a pipeline. Only the focal person, creator or an admin can. */
export async function updatePipelineRecord(
  userId: string,
  pipelineId: string,
  payload: PreparedPipelinePayload,
): Promise<{ id: string }> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{ id: string }>(
      `UPDATE pipelines
       SET deal_name = $1,
           focal_person_id = $2,
           contribution_type = $3,
           category_id = $4,
           party_type = $5,
           contact_id = $6,
           poc_contact_id = $7,
           secondary_contact_id = $8,
           stage_id = $9,
           expected_amount = $10,
           currency = $11,
           amount_base = $12,
           payment_interval = $13,
           expected_close = $14,
           country = $15,
           description = $16,
           operational_budget = $17,
           notes = $18,
           in_kind_valuation_note = $19,
           lost_reason = $20,
           updated_at = now()
       WHERE id = $21
       RETURNING id`,
      [
        payload.deal_name,
        payload.focal_person_id,
        payload.contribution_type,
        payload.category_id,
        payload.party_type,
        payload.contact_id,
        payload.poc_contact_id,
        payload.secondary_contact_id,
        payload.stage_id,
        payload.expected_amount,
        payload.currency,
        payload.amount_base,
        payload.payment_interval,
        payload.expected_close,
        payload.country,
        payload.description,
        payload.operational_budget,
        payload.notes,
        payload.in_kind_valuation_note,
        payload.lost_reason,
        pipelineId,
      ],
    );

    if (res.rowCount === 0) {
      throw new Error('Pipeline not found or you do not have permission to edit it.');
    }

    return { id: res.rows[0].id };
  });
}

/** Moves a pipeline to a stage. Lost needs a reason; the trigger writes the stage history. */
export async function changePipelineStageRecord(
  userId: string,
  pipelineId: string,
  toStageId: string,
  reason?: string | null,
): Promise<{ id: string; stageKind: StageKind }> {
  return withUserTransaction(userId, async (client) => {
    const stageRes = await client.query<{ id: string; kind: StageKind }>(
      `SELECT id, kind FROM pipeline_stages WHERE id = $1`,
      [toStageId],
    );
    const targetStage = stageRes.rows[0];
    if (!targetStage) {
      throw new Error('Target stage does not exist.');
    }

    const cleanReason = reason?.trim() ? reason.trim() : null;
    const moveCheck = canMoveToKind(targetStage.kind, cleanReason);
    if (!moveCheck.allowed) {
      throw new Error(moveCheck.error);
    }

    const res = await client.query<{ id: string }>(
      `UPDATE pipelines
       SET stage_id = $1,
           lost_reason = CASE
             WHEN $2::stage_kind IN ('lost', 'junk') THEN COALESCE($3, lost_reason)
             ELSE NULL
           END,
           updated_at = now()
       WHERE id = $4
       RETURNING id`,
      [toStageId, targetStage.kind, cleanReason, pipelineId],
    );

    if (res.rowCount === 0) {
      throw new Error('Pipeline not found or you do not have permission to change its stage.');
    }

    return { id: res.rows[0].id, stageKind: targetStage.kind };
  });
}

/** Records a receipt on a Won pipeline. amount_base uses the latest FX rate on or before received_on. */
export async function addPipelineReceiptRecord(
  userId: string,
  input: RecordReceiptInput,
): Promise<{ id: string; amount_base: number }> {
  return withUserTransaction(userId, async (client) => {
    const pipeRes = await client.query<{
      id: string;
      stage_kind: StageKind;
    }>(
      `SELECT p.id, s.kind AS stage_kind
       FROM pipelines p
       JOIN pipeline_stages s ON s.id = p.stage_id
       WHERE p.id = $1`,
      [input.pipeline_id],
    );

    const pipeline = pipeRes.rows[0];
    if (!pipeline) {
      throw new Error('Pipeline not found.');
    }

    const receiptCheck = validateReceiptAllowed(pipeline.stage_kind, input.amount);
    if (!receiptCheck.allowed) {
      throw new Error(receiptCheck.error);
    }

    const fxRes = await client.query<{
      currency: string;
      rate_to_base: string;
      effective_from: string;
    }>(
      `SELECT currency, rate_to_base::text, effective_from::text
       FROM fx_rates
       ORDER BY effective_from DESC`,
    );

    const rates: FxRateOption[] = fxRes.rows.map((r) => ({
      currency: r.currency,
      rate_to_base: Number(r.rate_to_base),
      effective_from: r.effective_from,
    }));

    const currency = input.currency.trim().toUpperCase();
    const amountBase = computeBase(input.amount, currency, rates, input.received_on);

    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO pipeline_receipts (
         pipeline_id,
         amount,
         currency,
         amount_base,
         received_on,
         note,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.pipeline_id,
        input.amount,
        currency,
        amountBase,
        input.received_on,
        input.note?.trim() ? input.note.trim() : null,
        userId,
      ],
    );

    return { id: insertRes.rows[0].id, amount_base: amountBase };
  });
}

/** Short pipeline list for the meeting and activity pickers. */
export async function listPipelinesLite(userId: string): Promise<PipelineLiteOption[]> {
  return withUserTransaction(userId, async (client) => {
    const res = await client.query<{
      id: string;
      deal_name: string;
      contact_id: string;
      contact_name: string;
      stage_name: string;
      stage_kind: StageKind;
      amount_base: string;
    }>(
      `SELECT
         p.id,
         p.deal_name,
         p.contact_id,
         c.name AS contact_name,
         s.name AS stage_name,
         s.kind AS stage_kind,
         p.amount_base::text
       FROM pipelines p
       JOIN contacts c ON c.id = p.contact_id
       JOIN pipeline_stages s ON s.id = p.stage_id
       ORDER BY p.deal_name ASC`,
    );

    return res.rows.map((r) => ({
      ...r,
      amount_base: Number(r.amount_base),
    }));
  });
}
