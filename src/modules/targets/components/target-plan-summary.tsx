import * as React from 'react';
import { Card, KpiTile, Money } from '@/shared/ui';
import type { TargetMemberOption, TargetVerticalOption } from '../repository';
import { quarterShare, TARGET_QUARTERS, type TargetPlanLine } from '../service';

export interface TargetPlanSummaryProps {
  annual: number;
  /** Quarter amounts indexed by quarter - 1. */
  quarters: number[];
  lines: TargetPlanLine[];
  members: TargetMemberOption[];
  verticals: TargetVerticalOption[];
}

function sumAmounts(lines: TargetPlanLine[]): number {
  return Math.round(lines.reduce((acc, l) => acc + Math.round(l.amount * 100), 0)) / 100;
}

function MemberVerticalGrid({
  lines,
  members,
  verticals,
  caption,
}: {
  lines: TargetPlanLine[];
  members: TargetMemberOption[];
  verticals: TargetVerticalOption[];
  caption: string;
}) {
  const memberIds = new Set(lines.map((l) => l.user_id));
  const rows = members.filter((m) => memberIds.has(m.id));

  if (rows.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No member targets in this period.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[13px] leading-5">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Member
            </th>
            {verticals.map((v) => (
              <th key={v.id} scope="col" className="px-3 py-2 text-right font-medium">
                {v.name}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => {
            const memberLines = lines.filter((l) => l.user_id === member.id);
            return (
              <tr key={member.id} className="border-t border-border">
                <th scope="row" className="px-3 py-2.5 text-left font-medium text-foreground">
                  {member.full_name}
                </th>
                {verticals.map((v) => {
                  const cell = memberLines.filter((l) => l.vertical_id === v.id);
                  return (
                    <td key={v.id} className="px-3 py-2.5 text-right">
                      {cell.length > 0 ? <Money amount={sumAmounts(cell)} /> : '—'}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-medium">
                  <Money amount={sumAmounts(memberLines)} />
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-border-strong bg-surface font-medium">
            <th scope="row" className="px-3 py-2.5 text-left">
              Team total
            </th>
            {verticals.map((v) => (
              <td key={v.id} className="px-3 py-2.5 text-right">
                <Money amount={sumAmounts(lines.filter((l) => l.vertical_id === v.id))} />
              </td>
            ))}
            <td className="px-3 py-2.5 text-right">
              <Money amount={sumAmounts(lines)} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Read-only plan breakdown: annual, quarters, then member x vertical. Used for published plans and the wizard review. */
export function TargetPlanSummary({
  annual,
  quarters,
  lines,
  members,
  verticals,
}: TargetPlanSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label="Annual target" value={<Money amount={annual} />} />
        {TARGET_QUARTERS.map((q) => (
          <KpiTile
            key={q}
            label={`Q${q} target`}
            value={<Money amount={quarters[q - 1] ?? 0} />}
            context={`${quarterShare(quarters[q - 1] ?? 0, annual).toFixed(1)}% of annual`}
          />
        ))}
      </div>

      <Card
        title="Full year by member and vertical"
        description="Sum of the four quarterly targets."
        compact
      >
        <MemberVerticalGrid
          lines={lines}
          members={members}
          verticals={verticals}
          caption="Annual targets by member and vertical"
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {TARGET_QUARTERS.map((q) => (
          <Card key={q} title={`Q${q}`} description="Target by member and vertical." compact>
            <MemberVerticalGrid
              lines={lines.filter((l) => l.quarter === q)}
              members={members}
              verticals={verticals}
              caption={`Q${q} targets by member and vertical`}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
