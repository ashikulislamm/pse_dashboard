import { describe, expect, it } from 'vitest';
import type { TargetPlanDraft } from './schema';
import {
  allocationsFromLines,
  buildPlanLines,
  canManageTargets,
  splitEvenly,
  summarizePlan,
  validatePlan,
} from './service';

const U1 = '10000000-0000-0000-0000-000000000003';
const U2 = '10000000-0000-0000-0000-000000000004';
const DSP = '60000000-0000-0000-0000-000000000001';
const VBD = '60000000-0000-0000-0000-000000000002';
const PROJECT = '60000000-0000-0000-0000-000000000003';

function validDraft(): TargetPlanDraft {
  const shares = [
    { vertical_id: DSP, percent: 50 },
    { vertical_id: VBD, percent: 30 },
    { vertical_id: PROJECT, percent: 20 },
  ];
  return {
    year: 2027,
    annual_amount: 1_000_000,
    quarters: [100_000, 200_000, 300_000, 400_000],
    allocations: [1, 2, 3, 4].flatMap((quarter) => {
      const total = quarter * 100_000;
      return [
        { quarter, user_id: U1, amount: total / 2, verticals: shares },
        { quarter, user_id: U2, amount: total / 2, verticals: shares },
      ];
    }),
  };
}

describe('canManageTargets', () => {
  it('allows only admin and target_manager', () => {
    expect(canManageTargets('admin')).toBe(true);
    expect(canManageTargets('target_manager')).toBe(true);
    expect(canManageTargets('member')).toBe(false);
  });
});

describe('splitEvenly', () => {
  it('sums exactly with no 0.01 gap', () => {
    const parts = splitEvenly(100, 3);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(10_000);
  });

  it('handles zero and empty cases', () => {
    expect(splitEvenly(0, 3)).toEqual([0, 0, 0]);
    expect(splitEvenly(100, 0)).toEqual([]);
  });
});

describe('summarizePlan', () => {
  it('reports remaining to allocate at every level', () => {
    const draft = validDraft();
    draft.quarters = [100_000, 100_000, 0, 0];
    draft.allocations = [{ quarter: 1, user_id: U1, amount: 40_000, verticals: [] }];
    const summary = summarizePlan(draft);
    expect(summary.quartersTotal).toBe(200_000);
    expect(summary.annualRemaining).toBe(800_000);
    expect(summary.quarters[0].remaining).toBe(60_000);
    expect(summary.quarters[1].remaining).toBe(100_000);
  });
});

describe('validatePlan', () => {
  it('accepts a fully reconciled uneven plan', () => {
    expect(validatePlan(validDraft())).toEqual([]);
  });

  it('rejects quarters that do not add up to the annual target', () => {
    const draft = validDraft();
    draft.quarters = [100_000, 200_000, 300_000, 300_000];
    const issues = validatePlan(draft);
    expect(issues.some((i) => i.step === 'quarters')).toBe(true);
  });

  it('flags over-allocated quarters', () => {
    const draft = validDraft();
    draft.quarters = [500_000, 200_000, 300_000, 400_000];
    const issue = validatePlan(draft).find((i) => i.step === 'quarters');
    expect(issue?.message).toMatch(/exceed/i);
  });

  it('rejects member amounts that do not add up to the quarter', () => {
    const draft = validDraft();
    draft.allocations[0].amount = 10;
    const issue = validatePlan(draft).find((i) => i.step === 'members' && i.quarter === 1);
    expect(issue).toBeDefined();
  });

  it('rejects vertical percentages that do not total 100', () => {
    const draft = validDraft();
    draft.allocations[0].verticals = [
      { vertical_id: DSP, percent: 50 },
      { vertical_id: VBD, percent: 40 },
    ];
    const issue = validatePlan(draft).find((i) => i.step === 'verticals');
    expect(issue?.message).toMatch(/100%/);
  });

  it('rejects the same member listed twice in one quarter', () => {
    const draft = validDraft();
    draft.allocations.push({ ...draft.allocations[0] });
    expect(validatePlan(draft).some((i) => /more than once/.test(i.message))).toBe(true);
  });

  it('requires a positive annual target', () => {
    const draft = validDraft();
    draft.annual_amount = 0;
    expect(validatePlan(draft).some((i) => i.step === 'annual')).toBe(true);
  });
});

describe('buildPlanLines', () => {
  it('produces lines that sum exactly to each member amount', () => {
    const draft: TargetPlanDraft = {
      year: 2027,
      annual_amount: 100,
      quarters: [100, 0, 0, 0],
      allocations: [
        {
          quarter: 1,
          user_id: U1,
          amount: 100,
          verticals: [
            { vertical_id: DSP, percent: 33.333 },
            { vertical_id: VBD, percent: 33.333 },
            { vertical_id: PROJECT, percent: 33.334 },
          ],
        },
      ],
    };
    const lines = buildPlanLines(draft);
    expect(lines).toHaveLength(3);
    expect(Math.round(lines.reduce((a, l) => a + l.amount * 100, 0))).toBe(10_000);
  });

  it('skips zero-amount members and zero-percent verticals', () => {
    const draft = validDraft();
    draft.allocations = [
      { quarter: 1, user_id: U1, amount: 0, verticals: [{ vertical_id: DSP, percent: 100 }] },
      {
        quarter: 1,
        user_id: U2,
        amount: 100,
        verticals: [
          { vertical_id: DSP, percent: 100 },
          { vertical_id: VBD, percent: 0 },
        ],
      },
    ];
    const lines = buildPlanLines(draft);
    expect(lines).toEqual([
      { quarter: 1, user_id: U2, vertical_id: DSP, percent: 100, amount: 100 },
    ]);
  });

  it('round-trips through allocationsFromLines', () => {
    const draft = validDraft();
    const rebuilt = allocationsFromLines(buildPlanLines(draft));
    expect(rebuilt).toHaveLength(draft.allocations.length);
    expect(rebuilt.find((a) => a.quarter === 3 && a.user_id === U1)?.amount).toBe(150_000);
  });
});
