'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DateText, EmptyState, PageHeader, Select, Tag } from '@/shared/ui';
import type { TargetMemberOption, TargetPlanRecord, TargetVerticalOption } from '../repository';
import type { TargetPlanDraft } from '../schema';
import { TargetPlanSummary } from './target-plan-summary';
import { TargetWizard } from './target-wizard';

export interface TargetsViewProps {
  canManage: boolean;
  year: number;
  yearOptions: number[];
  plan: TargetPlanRecord | null;
  draft: TargetPlanDraft | null;
  members: TargetMemberOption[];
  verticals: TargetVerticalOption[];
}

export function TargetsView({
  canManage,
  year,
  yearOptions,
  plan,
  draft,
  members,
  verticals,
}: TargetsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const published = Boolean(plan?.locked_at);

  return (
    <div>
      <PageHeader
        title="Targets"
        description="Annual, quarterly, member, and vertical fundraising targets in BDT."
        actions={
          <div className="flex items-center gap-2">
            {plan && <Tag>{published ? 'Published' : 'Draft'}</Tag>}
            <Select
              id="targets-year"
              aria-label="Target year"
              value={year}
              disabled={isPending}
              onChange={(e) =>
                startTransition(() => router.push(`/targets?year=${e.target.value}`))
              }
              className="h-8 w-28 text-[13px]"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {plan && published ? (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Published on <DateText value={plan.locked_at} />
            {plan.locked_by_name ? ` by ${plan.locked_by_name}` : ''}. Published targets are locked
            and cannot be changed.
          </p>
          <TargetPlanSummary
            annual={plan.annual_amount}
            quarters={plan.quarters}
            lines={plan.lines}
            members={members}
            verticals={verticals}
          />
        </div>
      ) : canManage ? (
        <TargetWizard
          key={year}
          year={year}
          initialDraft={draft}
          members={members}
          verticals={verticals}
        />
      ) : (
        <EmptyState message={`No targets have been published for ${year} yet.`} />
      )}
    </div>
  );
}
