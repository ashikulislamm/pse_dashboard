'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Field, Select, Tag, Textarea, type TagTone } from '@/shared/ui';
import type { StageKind } from '@/types/database';
import { changePipelineStageAction } from '../actions';
import type { StageOption } from '../service';

export interface StageQuickSelectProps {
  pipelineId: string;
  dealName: string;
  currentStageId: string;
  currentStageName: string;
  currentStageKind: StageKind;
  stages: StageOption[];
  canEdit: boolean;
  compact?: boolean;
}

export function stageKindTone(kind: StageKind): TagTone {
  switch (kind) {
    case 'won':
      return 'positive';
    case 'lost':
      return 'negative';
    default:
      return 'neutral';
  }
}

/**
 * Stage selector dropdown with built-in confirmation / reason dialog for Won, Lost, and Junk transitions.
 */
export function StageQuickSelect({
  pipelineId,
  dealName,
  currentStageId,
  currentStageName,
  currentStageKind,
  stages,
  canEdit,
  compact = false,
}: StageQuickSelectProps) {
  const router = useRouter();
  const [pendingStage, setPendingStage] = React.useState<StageOption | null>(null);
  const [reason, setReason] = React.useState('');
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  if (!canEdit) {
    return <Tag tone={stageKindTone(currentStageKind)}>{currentStageName}</Tag>;
  }

  const executeTransition = async (targetStage: StageOption, stageReason?: string) => {
    setSubmitting(true);
    setReasonError(null);
    try {
      const res = await changePipelineStageAction({
        pipeline_id: pipelineId,
        to_stage_id: targetStage.id,
        reason: stageReason ?? null,
      });

      if (res.status === 'error') {
        setReasonError(res.message);
        toast.error(res.message);
        return;
      }

      toast.success(`Moved "${dealName}" to ${targetStage.name}.`);
      setPendingStage(null);
      setReason('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStageId = e.target.value;
    if (!nextStageId || nextStageId === currentStageId) return;

    const target = stages.find((s) => s.id === nextStageId);
    if (!target) return;

    if (target.kind === 'open') {
      void executeTransition(target);
      return;
    }

    setReason('');
    setReasonError(null);
    setPendingStage(target);
  };

  const handleConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingStage) return;

    if (pendingStage.kind === 'lost' && !reason.trim()) {
      setReasonError('Enter a reason before moving this pipeline to Lost.');
      return;
    }

    void executeTransition(pendingStage, reason);
  };

  return (
    <>
      <Select
        value={currentStageId}
        onChange={handleSelectChange}
        disabled={submitting}
        aria-label={`Change stage for ${dealName}`}
        className={
          compact
            ? 'h-7 min-w-[148px] px-2 py-0.5 text-[12px] font-medium'
            : 'h-8 min-w-[180px] text-[13px] font-medium'
        }
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      {pendingStage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`stage-modal-title-${pipelineId}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setPendingStage(null);
            }
          }}
        >
          <form
            onSubmit={handleConfirmModal}
            className="w-full max-w-[440px] rounded-md border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]"
          >
            <h2
              id={`stage-modal-title-${pipelineId}`}
              className="text-[16px] leading-6 font-semibold text-foreground"
            >
              {pendingStage.kind === 'won'
                ? `Mark "${dealName}" as Won?`
                : pendingStage.kind === 'lost'
                  ? `Move "${dealName}" to Lost`
                  : `Move "${dealName}" to ${pendingStage.name}`}
            </h2>

            <p className="mt-2 text-[14px] leading-5 text-muted-foreground">
              {pendingStage.kind === 'won'
                ? 'This records the commitment timestamp and unlocks realized receipt recording. Dashboard achievement only increases when receipts are recorded.'
                : pendingStage.kind === 'lost'
                  ? 'Provide the reason this opportunity was lost for pipeline review.'
                  : 'Optionally add a note explaining why this opportunity was abandoned.'}
            </p>

            {(pendingStage.kind === 'lost' || pendingStage.kind === 'junk') && (
              <div className="mt-4">
                <Field
                  id={`stage-reason-${pipelineId}`}
                  label={
                    pendingStage.kind === 'lost'
                      ? 'Lost reason'
                      : 'Abandoned reason'
                  }
                  requiredLabel={pendingStage.kind === 'lost'}
                  optional={pendingStage.kind === 'junk'}
                  error={reasonError ?? undefined}
                >
                  <Textarea
                    id={`stage-reason-${pipelineId}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      pendingStage.kind === 'lost'
                        ? 'e.g., Donor CSR budget reallocated to emergency relief for Q3.'
                        : 'Optional context for abandoning this lead…'
                    }
                    hasError={Boolean(reasonError)}
                    autoFocus
                  />
                </Field>
              </div>
            )}

            {reasonError && pendingStage.kind === 'won' && (
              <p className="mt-3 text-[12px] text-negative">{reasonError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => setPendingStage(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={pendingStage.kind === 'lost' ? 'destructive' : 'primary'}
                disabled={submitting}
              >
                {submitting
                  ? 'Saving…'
                  : pendingStage.kind === 'won'
                    ? 'Confirm Won'
                    : `Move to ${pendingStage.name}`}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
