import { describe, expect, it } from 'vitest';
import {
  canEditPipeline,
  canMoveToKind,
  computeBase,
  computePipelineAchievementSummary,
  preparePipelinePayload,
  validateReceiptAllowed,
  type FxRateOption,
  type StageOption,
} from './service';

const FX_RATES: FxRateOption[] = [
  { currency: 'BDT', rate_to_base: 1, effective_from: '2026-01-01' },
  { currency: 'USD', rate_to_base: 120, effective_from: '2026-01-01' },
  { currency: 'EUR', rate_to_base: 130, effective_from: '2026-01-01' },
];

const STAGES: StageOption[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Qualified Lead', kind: 'open', position: 2 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Contract Signed (Won)', kind: 'won', position: 6 },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Lost', kind: 'lost', position: 7 },
];

describe('pipelines service', () => {
  it('computes base BDT amount using latest FX rate', () => {
    expect(computeBase(50000, 'BDT', FX_RATES)).toBe(50000);
    expect(computeBase(10000, 'USD', FX_RATES)).toBe(1200000);
    expect(computeBase(2500.5, 'EUR', FX_RATES)).toBe(325065);
  });

  it('rejects in-kind pipelines without valuation note and preserves note for in-kind', () => {
    expect(() =>
      preparePipelinePayload(
        {
          deal_name: 'Medical Equipment Donation',
          focal_person_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contribution_type: 'in_kind',
          category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          party_type: 'individual',
          contact_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          stage_id: STAGES[0].id,
          expected_amount: 450000,
          currency: 'BDT',
          payment_interval: 'one_time',
          in_kind_valuation_note: '   ',
        },
        FX_RATES,
        STAGES,
      ),
    ).toThrow(/in-kind valuation note/i);

    const prepared = preparePipelinePayload(
      {
        deal_name: 'Medical Equipment Donation',
        focal_person_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contribution_type: 'in_kind',
        category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        party_type: 'individual',
        contact_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        stage_id: STAGES[0].id,
        expected_amount: 1000,
        currency: 'USD',
        payment_interval: 'one_time',
        in_kind_valuation_note: 'Valued by procurement invoice #901',
      },
      FX_RATES,
      STAGES,
    );

    expect(prepared.amount_base).toBe(120000);
    expect(prepared.in_kind_valuation_note).toBe('Valued by procurement invoice #901');
    expect(prepared.poc_contact_id).toBeNull();
  });

  it('requires POC contact for company pipelines and clears POC for individual pipelines', () => {
    expect(() =>
      preparePipelinePayload(
        {
          deal_name: 'Corporate CSR Grant',
          focal_person_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contribution_type: 'cash',
          category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          party_type: 'company',
          contact_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          poc_contact_id: null,
          stage_id: STAGES[0].id,
          expected_amount: 1500000,
          currency: 'BDT',
          payment_interval: 'annual',
        },
        FX_RATES,
        STAGES,
      ),
    ).toThrow(/Point of Contact/i);
  });

  it('enforces lost_reason when moving to a Lost stage', () => {
    expect(canMoveToKind('lost', '')).toEqual({
      allowed: false,
      error: 'Enter a lost reason before moving this pipeline to a Lost stage.',
    });
    expect(canMoveToKind('lost', 'Budget reallocated for FY26')).toEqual({
      allowed: true,
    });
    expect(canMoveToKind('won', null)).toEqual({ allowed: true });
  });

  it('allows receipts only when stage kind is won and computes unrealized / over-received accurately', () => {
    expect(validateReceiptAllowed('open', 100000).allowed).toBe(false);
    expect(validateReceiptAllowed('won', 0).allowed).toBe(false);
    expect(validateReceiptAllowed('won', 100000).allowed).toBe(true);

    const partial = computePipelineAchievementSummary(1000000, 600000);
    expect(partial).toEqual({
      expectedBase: 1000000,
      receivedBase: 600000,
      unrealizedBase: 400000,
      overReceivedBase: 0,
      isOverReceived: false,
    });

    const over = computePipelineAchievementSummary(1000000, 1150000);
    expect(over).toEqual({
      expectedBase: 1000000,
      receivedBase: 1150000,
      unrealizedBase: 0,
      overReceivedBase: 150000,
      isOverReceived: true,
    });
  });

  it('enforces focal_person / creator / admin write check', () => {
    const pipeline = { focal_person_id: 'user-1', created_by: 'user-2' };
    expect(canEditPipeline({ id: 'user-1', role: 'member' }, pipeline)).toBe(true);
    expect(canEditPipeline({ id: 'user-2', role: 'member' }, pipeline)).toBe(true);
    expect(canEditPipeline({ id: 'user-3', role: 'member' }, pipeline)).toBe(false);
    expect(canEditPipeline({ id: 'user-3', role: 'admin' }, pipeline)).toBe(true);
  });
});
