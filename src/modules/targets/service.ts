import { allocateByPercent, roundCurrency } from '@/shared/lib/money';
import type { AppRole } from '@/types/database';
import type { TargetAllocation, TargetPlanDraft } from './schema';

export const TARGET_QUARTERS = [1, 2, 3, 4] as const;

export type TargetWizardStep = 'annual' | 'quarters' | 'members' | 'verticals';

export interface TargetPlanIssue {
  step: TargetWizardStep;
  quarter?: number;
  userId?: string;
  message: string;
}

export interface TargetPlanLine {
  quarter: number;
  user_id: string;
  vertical_id: string;
  percent: number;
  amount: number;
}

export interface QuarterSummary {
  quarter: number;
  amount: number;
  allocated: number;
  remaining: number;
}

export interface TargetPlanTotals {
  annual: number;
  quartersTotal: number;
  annualRemaining: number;
  quarters: QuarterSummary[];
}

/** Amounts are compared in whole cents so floating point drift can never create a 0.01 gap. */
function cents(value: number): number {
  return Math.round(roundCurrency(value) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/** Only an admin or target manager may create, edit, or publish a target plan. */
export function canManageTargets(role: AppRole): boolean {
  return role === 'admin' || role === 'target_manager';
}

/** Splits `total` into `count` parts that add up exactly (extra cents go to the first parts). */
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const totalCents = cents(Math.max(0, total));
  const base = Math.floor(totalCents / count);
  const extra = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => fromCents(base + (i < extra ? 1 : 0)));
}

export function percentTotal(shares: { percent: number }[]): number {
  return roundPercent(shares.reduce((acc, s) => acc + s.percent, 0));
}

export function summarizePlan(draft: TargetPlanDraft): TargetPlanTotals {
  const annualCents = cents(draft.annual_amount);
  const quartersCents = draft.quarters.map(cents);
  const quartersTotalCents = quartersCents.reduce((a, b) => a + b, 0);

  const quarters = TARGET_QUARTERS.map((quarter, idx) => {
    const allocatedCents = draft.allocations
      .filter((a) => a.quarter === quarter)
      .reduce((acc, a) => acc + cents(a.amount), 0);
    return {
      quarter,
      amount: fromCents(quartersCents[idx] ?? 0),
      allocated: fromCents(allocatedCents),
      remaining: fromCents((quartersCents[idx] ?? 0) - allocatedCents),
    };
  });

  return {
    annual: fromCents(annualCents),
    quartersTotal: fromCents(quartersTotalCents),
    annualRemaining: fromCents(annualCents - quartersTotalCents),
    quarters,
  };
}

/** Returns what blocks publishing; empty means ready. The DB re-checks all of it. */
export function validatePlan(draft: TargetPlanDraft): TargetPlanIssue[] {
  const issues: TargetPlanIssue[] = [];
  const summary = summarizePlan(draft);

  if (draft.annual_amount <= 0) {
    issues.push({ step: 'annual', message: 'Annual target must be greater than zero.' });
  }

  if (cents(summary.annualRemaining) !== 0) {
    const over = summary.annualRemaining < 0;
    issues.push({
      step: 'quarters',
      message: over
        ? 'Quarterly targets exceed the annual target. Reduce them until nothing is over-allocated.'
        : 'Quarterly targets must add up to the annual target. Allocate the remaining amount.',
    });
  }

  for (const q of summary.quarters) {
    const quarterAllocations = draft.allocations.filter((a) => a.quarter === q.quarter);
    const memberIds = quarterAllocations.map((a) => a.user_id);

    if (new Set(memberIds).size !== memberIds.length) {
      issues.push({
        step: 'members',
        quarter: q.quarter,
        message: `Q${q.quarter} lists the same member more than once.`,
      });
    }

    if (cents(q.remaining) !== 0) {
      issues.push({
        step: 'members',
        quarter: q.quarter,
        message:
          q.remaining > 0
            ? `Q${q.quarter}: allocate the remaining amount to members.`
            : `Q${q.quarter}: member targets exceed the quarter target.`,
      });
    }

    for (const allocation of quarterAllocations) {
      if (cents(allocation.amount) === 0) continue;

      const verticalIds = allocation.verticals.map((v) => v.vertical_id);
      if (new Set(verticalIds).size !== verticalIds.length) {
        issues.push({
          step: 'verticals',
          quarter: q.quarter,
          userId: allocation.user_id,
          message: `Q${q.quarter}: a vertical is listed more than once for one member.`,
        });
        continue;
      }

      if (Math.round(percentTotal(allocation.verticals) * 1000) !== 100_000) {
        issues.push({
          step: 'verticals',
          quarter: q.quarter,
          userId: allocation.user_id,
          message: `Q${q.quarter}: vertical percentages must total 100%.`,
        });
      }
    }
  }

  return issues;
}

/** Turns member amounts into member x vertical lines. Largest-remainder rounding keeps each member's lines exact; zero amounts or shares make no line. */
export function buildPlanLines(draft: TargetPlanDraft): TargetPlanLine[] {
  const lines: TargetPlanLine[] = [];

  for (const allocation of draft.allocations) {
    if (cents(allocation.amount) === 0 || allocation.verticals.length === 0) continue;

    const shares = allocation.verticals.map((v) => ({
      vertical_id: v.vertical_id,
      percent: roundPercent(v.percent),
    }));
    const amounts = allocateByPercent(
      allocation.amount,
      shares.map((s) => s.percent),
    );

    shares.forEach((share, idx) => {
      if (share.percent === 0 && amounts[idx] === 0) return;
      lines.push({
        quarter: allocation.quarter,
        user_id: allocation.user_id,
        vertical_id: share.vertical_id,
        percent: share.percent,
        amount: amounts[idx],
      });
    });
  }

  return lines;
}

/** Rebuilds wizard allocations from stored lines (member amount = sum of that member's lines). */
export function allocationsFromLines(lines: TargetPlanLine[]): TargetAllocation[] {
  const grouped = new Map<string, TargetAllocation>();

  for (const line of lines) {
    const key = `${line.quarter}:${line.user_id}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount = fromCents(cents(existing.amount) + cents(line.amount));
      existing.verticals.push({ vertical_id: line.vertical_id, percent: line.percent });
    } else {
      grouped.set(key, {
        quarter: line.quarter,
        user_id: line.user_id,
        amount: line.amount,
        verticals: [{ vertical_id: line.vertical_id, percent: line.percent }],
      });
    }
  }

  return [...grouped.values()].sort((a, b) => a.quarter - b.quarter);
}

/** Share of the annual target carried by each quarter, for the read-only summary. */
export function quarterShare(quarterAmount: number, annual: number): number {
  return annual > 0 ? (quarterAmount / annual) * 100 : 0;
}
