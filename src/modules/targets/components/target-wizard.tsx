'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, Field, Input, Money, Tag } from '@/shared/ui';
import {
  discardTargetDraftAction,
  publishTargetPlanAction,
  saveTargetDraftAction,
} from '../actions';
import type { TargetMemberOption, TargetVerticalOption } from '../repository';
import type { TargetAllocation, TargetPlanDraft } from '../schema';
import {
  buildPlanLines,
  percentTotal,
  splitEvenly,
  summarizePlan,
  TARGET_QUARTERS,
  validatePlan,
  type TargetWizardStep,
} from '../service';
import { TargetPlanSummary } from './target-plan-summary';

const STEPS: { id: TargetWizardStep | 'review'; label: string }[] = [
  { id: 'annual', label: 'Annual' },
  { id: 'quarters', label: 'Quarters' },
  { id: 'members', label: 'Members' },
  { id: 'verticals', label: 'Verticals' },
  { id: 'review', label: 'Review' },
];

interface MemberState {
  amount: string;
  shares: Record<string, string>;
}

/** Wizard state keyed by `${quarter}:${userId}`; text so partially typed numbers stay intact. */
type MemberStateMap = Record<string, MemberState>;

const memberKey = (quarter: number, userId: string) => `${quarter}:${userId}`;

function parseAmount(raw: string): number {
  const n = Number(raw.replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toText(value: number): string {
  return value > 0 ? String(value) : '';
}

function initialMemberState(allocations: TargetAllocation[]): MemberStateMap {
  const map: MemberStateMap = {};
  for (const a of allocations) {
    map[memberKey(a.quarter, a.user_id)] = {
      amount: toText(a.amount),
      shares: Object.fromEntries(a.verticals.map((v) => [v.vertical_id, toText(v.percent)])),
    };
  }
  return map;
}

export interface TargetWizardProps {
  year: number;
  initialDraft: TargetPlanDraft | null;
  members: TargetMemberOption[];
  verticals: TargetVerticalOption[];
}

export function TargetWizard({ year, initialDraft, members, verticals }: TargetWizardProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [annual, setAnnual] = React.useState(toText(initialDraft?.annual_amount ?? 0));
  const [quarterText, setQuarterText] = React.useState<string[]>(
    TARGET_QUARTERS.map((q) => toText(initialDraft?.quarters[q - 1] ?? 0)),
  );
  const [memberState, setMemberState] = React.useState<MemberStateMap>(() =>
    initialMemberState(initialDraft?.allocations ?? []),
  );
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasSavedDraft = initialDraft !== null;

  const draft = React.useMemo<TargetPlanDraft>(() => {
    const allocations: TargetAllocation[] = [];
    for (const quarter of TARGET_QUARTERS) {
      for (const member of members) {
        const state = memberState[memberKey(quarter, member.id)];
        if (!state) continue;
        const amount = parseAmount(state.amount);
        if (amount === 0) continue;
        allocations.push({
          quarter,
          user_id: member.id,
          amount,
          verticals: verticals
            .map((v) => ({ vertical_id: v.id, percent: parseAmount(state.shares[v.id] ?? '') }))
            .filter((v) => v.percent > 0),
        });
      }
    }
    return {
      year,
      annual_amount: parseAmount(annual),
      quarters: quarterText.map(parseAmount),
      allocations,
    };
  }, [annual, quarterText, memberState, members, verticals, year]);

  const summary = React.useMemo(() => summarizePlan(draft), [draft]);
  const issues = React.useMemo(() => validatePlan(draft), [draft]);
  const lines = React.useMemo(() => buildPlanLines(draft), [draft]);

  const stepValid = (id: (typeof STEPS)[number]['id']): boolean => {
    if (id === 'annual') return draft.annual_amount > 0;
    if (id === 'review') return issues.length === 0;
    return !issues.some((i) => i.step === id);
  };

  // A step is reachable once every earlier step is valid.
  const reachable = STEPS.map((_, idx) => STEPS.slice(0, idx).every((s) => stepValid(s.id)));

  const currentStep = STEPS[stepIndex];
  const nextDisabled = !stepValid(currentStep.id);

  const updateMember = (quarter: number, userId: string, patch: Partial<MemberState>) => {
    setMemberState((prev) => {
      const key = memberKey(quarter, userId);
      const current = prev[key] ?? { amount: '', shares: {} };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  const setShare = (quarter: number, userId: string, verticalId: string, value: string) => {
    const key = memberKey(quarter, userId);
    const current = memberState[key] ?? { amount: '', shares: {} };
    updateMember(quarter, userId, { shares: { ...current.shares, [verticalId]: value } });
  };

  const splitQuartersEvenly = () => {
    setQuarterText(splitEvenly(parseAmount(annual), 4).map(toText));
  };

  const splitMembersEvenly = (quarter: number) => {
    const amounts = splitEvenly(draft.quarters[quarter - 1] ?? 0, members.length);
    setMemberState((prev) => {
      const next = { ...prev };
      members.forEach((m, idx) => {
        const key = memberKey(quarter, m.id);
        next[key] = { shares: next[key]?.shares ?? {}, amount: toText(amounts[idx]) };
      });
      return next;
    });
  };

  const splitVerticalsEvenly = (quarter: number, userId: string) => {
    const shares = splitEvenly(100, verticals.length);
    updateMember(quarter, userId, {
      shares: Object.fromEntries(verticals.map((v, idx) => [v.id, toText(shares[idx])])),
    });
  };

  const copyVerticalsFromPreviousQuarter = (quarter: number) => {
    setMemberState((prev) => {
      const next = { ...prev };
      for (const m of members) {
        const source = prev[memberKey(quarter - 1, m.id)];
        const key = memberKey(quarter, m.id);
        if (!source || !next[key]) continue;
        next[key] = { ...next[key], shares: { ...source.shares } };
      }
      return next;
    });
  };

  const saveDraft = async (): Promise<boolean> => {
    if (draft.annual_amount <= 0) {
      setError('Enter the annual target before saving.');
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await saveTargetDraftAction(draft);
      if (res.status === 'error') {
        setError(res.message);
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (await saveDraft()) {
      toast.success('Draft saved.');
      router.refresh();
    }
  };

  const goNext = async () => {
    if (nextDisabled) return;
    if (!(await saveDraft())) return;
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await publishTargetPlanAction(draft);
      if (res.status === 'error') {
        setError(res.message);
        setConfirmPublish(false);
        return;
      }
      toast.success(`${year} targets published.`);
      setConfirmPublish(false);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    setSaving(true);
    try {
      const res = await discardTargetDraftAction(year);
      if (res.status === 'error') {
        setError(res.message);
      } else {
        toast.success('Draft discarded.');
        setConfirmDiscard(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const remainingTone =
    summary.annualRemaining === 0
      ? 'text-positive'
      : summary.annualRemaining < 0
        ? 'text-negative'
        : 'text-foreground';

  return (
    <div className="space-y-6">
      <nav aria-label="Target setup steps">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((step, idx) => {
            const active = idx === stepIndex;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!reachable[idx]}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => setStepIndex(idx)}
                  className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:outline-none disabled:opacity-50 ${
                    active
                      ? 'border-primary bg-primary-subtle text-primary'
                      : 'border-border-strong text-foreground hover:bg-surface-2'
                  }`}
                >
                  <span className="tabular-nums">{idx + 1}</span>
                  {step.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-border bg-surface px-4 py-3 text-[13px] leading-5">
        <span className="text-muted-foreground">
          Annual target <Money amount={summary.annual} className="font-medium text-foreground" />
        </span>
        <span className="text-muted-foreground">
          Allocated to quarters{' '}
          <Money amount={summary.quartersTotal} className="font-medium text-foreground" />
        </span>
        <span className="text-muted-foreground">
          Remaining to allocate{' '}
          <Money amount={summary.annualRemaining} className={`font-medium ${remainingTone}`} />
        </span>
        {hasSavedDraft && <Tag>Draft</Tag>}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-negative bg-negative-subtle p-3 text-[13px] text-negative"
        >
          {error}
        </div>
      )}

      {currentStep.id === 'annual' && (
        <Card
          title={`Annual team target for ${year}`}
          description="Total amount the PSE team aims to raise this year, in BDT."
        >
          <div className="max-w-sm">
            <Field id="target-annual" label="Annual target (BDT)" requiredLabel>
              <Input
                id="target-annual"
                inputMode="decimal"
                value={annual}
                onChange={(e) => setAnnual(e.target.value)}
                placeholder="12000000"
              />
            </Field>
          </div>
        </Card>
      )}

      {currentStep.id === 'quarters' && (
        <Card
          title="Quarterly targets"
          description="Quarters can be uneven, but they must add up to the annual target."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TARGET_QUARTERS.map((q) => (
              <Field key={q} id={`target-q${q}`} label={`Q${q} (BDT)`}>
                <Input
                  id={`target-q${q}`}
                  inputMode="decimal"
                  value={quarterText[q - 1]}
                  onChange={(e) =>
                    setQuarterText((prev) => prev.map((t, i) => (i === q - 1 ? e.target.value : t)))
                  }
                  placeholder="0"
                />
              </Field>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <Button variant="secondary" size="compact" onClick={splitQuartersEvenly}>
              Split annual target evenly
            </Button>
            <span className={remainingTone}>
              {summary.annualRemaining === 0 ? (
                'Quarters add up to the annual target.'
              ) : summary.annualRemaining > 0 ? (
                <>
                  Remaining to allocate: <Money amount={summary.annualRemaining} />
                </>
              ) : (
                <>
                  Over-allocated by: <Money amount={-summary.annualRemaining} />
                </>
              )}
            </span>
          </div>
        </Card>
      )}

      {currentStep.id === 'members' && (
        <div className="space-y-4">
          {TARGET_QUARTERS.map((q) => {
            const qs = summary.quarters[q - 1];
            return (
              <Card
                key={q}
                title={`Q${q} — member targets`}
                description="Member amounts must add up to the quarter target."
              >
                <p className="mb-3 text-[13px] text-muted-foreground">
                  Quarter target{' '}
                  <Money amount={qs.amount} className="font-medium text-foreground" />
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((m) => (
                    <Field key={m.id} id={`target-${q}-${m.id}`} label={m.full_name}>
                      <Input
                        id={`target-${q}-${m.id}`}
                        inputMode="decimal"
                        value={memberState[memberKey(q, m.id)]?.amount ?? ''}
                        onChange={(e) => updateMember(q, m.id, { amount: e.target.value })}
                        placeholder="0"
                      />
                    </Field>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={() => splitMembersEvenly(q)}
                    disabled={qs.amount <= 0}
                  >
                    Split evenly across members
                  </Button>
                  <span
                    className={
                      qs.remaining === 0
                        ? 'text-positive'
                        : qs.remaining < 0
                          ? 'text-negative'
                          : 'text-foreground'
                    }
                  >
                    {qs.remaining === 0 ? (
                      'Fully allocated.'
                    ) : qs.remaining > 0 ? (
                      <>
                        Remaining to allocate: <Money amount={qs.remaining} />
                      </>
                    ) : (
                      <>
                        Over-allocated by: <Money amount={-qs.remaining} />
                      </>
                    )}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {currentStep.id === 'verticals' && (
        <div className="space-y-4">
          {TARGET_QUARTERS.map((q) => {
            const quarterMembers = members.filter(
              (m) => parseAmount(memberState[memberKey(q, m.id)]?.amount ?? '') > 0,
            );
            return (
              <Card
                key={q}
                title={`Q${q} — vertical split`}
                description="Each member's percentages across verticals must total 100%."
              >
                {quarterMembers.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    No member targets in this quarter.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {quarterMembers.map((m) => {
                      const state = memberState[memberKey(q, m.id)];
                      const shares = verticals.map((v) => ({
                        percent: parseAmount(state?.shares[v.id] ?? ''),
                      }));
                      const total = percentTotal(shares);
                      const amount = parseAmount(state?.amount ?? '');
                      return (
                        <div
                          key={m.id}
                          className="border-b border-border pb-4 last:border-b-0 last:pb-0"
                        >
                          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-[14px] font-medium text-foreground">
                              {m.full_name}{' '}
                              <span className="font-normal text-muted-foreground">
                                <Money amount={amount} />
                              </span>
                            </span>
                            <span
                              className={`text-[13px] tabular-nums ${total === 100 ? 'text-positive' : 'text-negative'}`}
                            >
                              Total {total}%
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {verticals.map((v) => (
                              <Field
                                key={v.id}
                                id={`share-${q}-${m.id}-${v.id}`}
                                label={`${v.name} (%)`}
                              >
                                <Input
                                  id={`share-${q}-${m.id}-${v.id}`}
                                  inputMode="decimal"
                                  value={state?.shares[v.id] ?? ''}
                                  onChange={(e) => setShare(q, m.id, v.id, e.target.value)}
                                  placeholder="0"
                                />
                              </Field>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="compact"
                            className="mt-2"
                            onClick={() => splitVerticalsEvenly(q, m.id)}
                          >
                            Split evenly
                          </Button>
                        </div>
                      );
                    })}
                    {q > 1 && (
                      <Button
                        variant="secondary"
                        size="compact"
                        onClick={() => copyVerticalsFromPreviousQuarter(q)}
                      >
                        Copy splits from Q{q - 1}
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {currentStep.id === 'review' && (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Publishing locks the plan. After that, no target can be changed.
          </p>
          <TargetPlanSummary
            annual={summary.annual}
            quarters={draft.quarters}
            lines={lines}
            members={members}
            verticals={verticals}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={stepIndex === 0 || saving}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            Back
          </Button>
          {hasSavedDraft && (
            <Button variant="destructive" disabled={saving} onClick={() => setConfirmDiscard(true)}>
              Discard draft
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" loading={saving} onClick={handleSaveDraft}>
            Save draft
          </Button>
          {currentStep.id === 'review' ? (
            <Button disabled={issues.length > 0} onClick={() => setConfirmPublish(true)}>
              Publish targets
            </Button>
          ) : (
            <Button disabled={nextDisabled} loading={saving} onClick={goNext}>
              Next
            </Button>
          )}
        </div>
      </div>

      {currentStep.id !== 'review' && nextDisabled && issues.length > 0 && (
        <p className="text-right text-[12px] text-muted-foreground">
          {issues.find((i) => i.step === currentStep.id)?.message}
        </p>
      )}

      <ConfirmDialog
        open={confirmPublish}
        title={`Publish ${year} targets`}
        description="Published targets are locked and cannot be edited or revised."
        confirmLabel="Publish targets"
        loading={publishing}
        onConfirm={handlePublish}
        onClose={() => setConfirmPublish(false)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title={`Discard ${year} draft`}
        description="The draft plan and all its allocations will be deleted."
        confirmLabel="Discard draft"
        destructive
        loading={saving}
        onConfirm={handleDiscard}
        onClose={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
