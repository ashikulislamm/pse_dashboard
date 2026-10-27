import { roundCurrency, toBase } from '@/shared/lib/money';
import type {
  AppRole,
  ContributionType,
  PartyType,
  PaymentInterval,
  StageKind,
} from '@/types/database';
import type { PipelineFormInput } from './schema';

export interface FxRateOption {
  currency: string;
  rate_to_base: number;
  effective_from: string;
}

export interface StageOption {
  id: string;
  name: string;
  kind: StageKind;
  position: number;
}

export interface PreparedPipelinePayload {
  deal_name: string;
  focal_person_id: string;
  contribution_type: ContributionType;
  category_id: string;
  party_type: PartyType;
  contact_id: string;
  poc_contact_id: string | null;
  secondary_contact_id: string | null;
  stage_id: string;
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
}

export interface PipelineAchievementSummary {
  expectedBase: number;
  receivedBase: number;
  unrealizedBase: number;
  overReceivedBase: number;
  isOverReceived: boolean;
}

/**
 * Resolves the latest FX rate (`rate_to_base`) for `currency` effective on or before `asOfDate`.
 * For `'BDT'` (the base currency), always returns `1`.
 */
export function resolveFxRate(
  currency: string,
  rates: FxRateOption[],
  asOfDate?: string,
): number {
  const code = currency.trim().toUpperCase();
  if (code === 'BDT') return 1;

  const targetDate = asOfDate ?? new Date().toISOString().slice(0, 10);
  const matching = rates
    .filter((r) => r.currency.toUpperCase() === code)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  if (matching.length === 0) {
    throw new Error(`No FX rate configured for currency "${code}".`);
  }

  const effectiveRow = matching.find((r) => r.effective_from <= targetDate) ?? matching[0];
  return Number(effectiveRow.rate_to_base);
}

/**
 * Converts `amount` in `currency` to base currency (BDT) using the latest FX rate `<= asOfDate`.
 */
export function computeBase(
  amount: number,
  currency: string,
  rates: FxRateOption[],
  asOfDate?: string,
): number {
  const rate = resolveFxRate(currency, rates, asOfDate);
  return toBase(amount, currency, rate);
}

/**
 * Checks whether a pipeline can transition to a stage of `targetKind` given `reason`.
 * Moving to `'lost'` requires a non-empty `reason`.
 */
export function canMoveToKind(
  targetKind: StageKind,
  reason?: string | null,
): { allowed: boolean; error?: string } {
  if (targetKind === 'lost' && (!reason || reason.trim().length === 0)) {
    return {
      allowed: false,
      error: 'Enter a lost reason before moving this pipeline to a Lost stage.',
    };
  }
  return { allowed: true };
}

/**
 * Validates whether a receipt can be recorded against a pipeline.
 * Per PHASES.md P4: Achievement comes only from `pipeline_receipts`, and receipts are allowed
 * only when the pipeline's current stage kind is `'won'`.
 */
export function validateReceiptAllowed(
  stageKind: StageKind,
  amount: number,
): { allowed: boolean; error?: string } {
  if (stageKind !== 'won') {
    return {
      allowed: false,
      error: 'Receipts can only be recorded when the pipeline is in a Won stage.',
    };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      allowed: false,
      error: 'Receipt amount must be greater than 0.',
    };
  }
  return { allowed: true };
}

/**
 * Computes Won vs. Received vs. Unrealized (and over-receipt flag) in base currency (BDT).
 */
export function computePipelineAchievementSummary(
  expectedAmountBase: number,
  receiptsBaseTotal: number,
): PipelineAchievementSummary {
  const expectedBase = roundCurrency(Math.max(0, expectedAmountBase));
  const receivedBase = roundCurrency(Math.max(0, receiptsBaseTotal));
  const unrealizedBase = roundCurrency(Math.max(0, expectedBase - receivedBase));
  const overReceivedBase = roundCurrency(Math.max(0, receivedBase - expectedBase));
  const isOverReceived = receivedBase > expectedBase + 0.005;

  return {
    expectedBase,
    receivedBase,
    unrealizedBase,
    overReceivedBase,
    isOverReceived,
  };
}

/**
 * Prepares and validates a `PipelineFormInput` into a sanitized DB payload:
 * - Enforces `expected_amount > 0`
 * - Enforces `in_kind_valuation_note` when `contribution_type === 'in_kind'` (and clears it for `'cash'`)
 * - Enforces `poc_contact_id` when `party_type === 'company'` (and clears POC/secondary for `'individual'`)
 * - Enforces `lost_reason` when target stage has `kind === 'lost'`
 * - Computes `amount_base` in BDT from `expected_amount` and `currency`
 */
export function preparePipelinePayload(
  input: PipelineFormInput,
  rates: FxRateOption[],
  stages: StageOption[],
): PreparedPipelinePayload {
  const cleanStr = (val?: string | null) => {
    const t = val?.trim();
    return t ? t : null;
  };

  if (!Number.isFinite(input.expected_amount) || input.expected_amount <= 0) {
    throw new Error('Expected amount must be greater than 0.');
  }

  const inKindNote =
    input.contribution_type === 'in_kind' ? cleanStr(input.in_kind_valuation_note) : null;
  if (input.contribution_type === 'in_kind' && !inKindNote) {
    throw new Error('Enter an in-kind valuation note (who valued it and basis).');
  }

  const pocContactId = input.party_type === 'company' ? cleanStr(input.poc_contact_id) : null;
  const secondaryContactId =
    input.party_type === 'company' ? cleanStr(input.secondary_contact_id) : null;

  if (input.party_type === 'company' && !pocContactId) {
    throw new Error('Select a Point of Contact (POC) for company pipelines.');
  }

  const targetStage = stages.find((s) => s.id === input.stage_id);
  if (!targetStage) {
    throw new Error('Select a valid pipeline stage.');
  }

  const lostReason = cleanStr(input.lost_reason);
  const moveCheck = canMoveToKind(targetStage.kind, lostReason);
  if (!moveCheck.allowed) {
    throw new Error(moveCheck.error);
  }

  const currency = input.currency.trim().toUpperCase();
  const expectedAmount = roundCurrency(input.expected_amount);
  const amountBase = computeBase(expectedAmount, currency, rates);

  const operationalBudget =
    input.operational_budget !== null &&
    input.operational_budget !== undefined &&
    Number.isFinite(input.operational_budget)
      ? roundCurrency(input.operational_budget)
      : null;

  return {
    deal_name: input.deal_name.trim(),
    focal_person_id: input.focal_person_id,
    contribution_type: input.contribution_type,
    category_id: input.category_id,
    party_type: input.party_type,
    contact_id: input.contact_id,
    poc_contact_id: pocContactId,
    secondary_contact_id: secondaryContactId,
    stage_id: input.stage_id,
    expected_amount: expectedAmount,
    currency,
    amount_base: amountBase,
    payment_interval: input.payment_interval ?? 'one_time',
    expected_close: cleanStr(input.expected_close),
    country: cleanStr(input.country),
    description: cleanStr(input.description),
    operational_budget: operationalBudget,
    notes: cleanStr(input.notes),
    in_kind_valuation_note: inKindNote,
    lost_reason:
      targetStage.kind === 'lost' || targetStage.kind === 'junk' ? lostReason : null,
  };
}

/**
 * Checks whether an authenticated PSE user is allowed to edit a pipeline or record receipts on it.
 * Writes are allowed for the pipeline's `focal_person_id`, `created_by`, or `admin`.
 */
export function canEditPipeline(
  actor: { id: string; role: AppRole },
  pipeline: { focal_person_id: string; created_by: string | null },
): boolean {
  return (
    actor.role === 'admin' ||
    pipeline.focal_person_id === actor.id ||
    pipeline.created_by === actor.id
  );
}
