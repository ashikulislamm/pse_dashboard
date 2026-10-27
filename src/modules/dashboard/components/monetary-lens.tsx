import * as React from 'react';
import {
  BarChart,
  Card,
  EmptyState,
  formatCompactNumber,
  formatMoney,
  KpiTile,
  LineChart,
  Money,
  TargetBar,
} from '@/shared/ui';
import type { StageKind } from '@/types/database';
import type { AttainmentRowView, MonetaryDashboard } from '../service';

const KIND_LABELS: Record<StageKind, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  junk: 'Abandoned',
};

function percentText(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function ViewAsTable({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="mt-4 text-[13px]">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {summary}
      </summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  );
}

function AttainmentList({
  rows,
  emptyMessage,
}: {
  rows: AttainmentRowView[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map((row) =>
        row.target > 0 ? (
          <TargetBar key={row.id} label={row.name} achieved={row.achieved} target={row.target} />
        ) : (
          <div
            key={row.id}
            className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] leading-5"
          >
            <span className="font-medium text-foreground">{row.name}</span>
            <span className="text-muted-foreground">
              <Money amount={row.achieved} className="font-medium text-foreground" /> received · no
              target
            </span>
          </div>
        ),
      )}
    </div>
  );
}

function AttainmentTable({
  rows,
  firstColumn,
}: {
  rows: AttainmentRowView[];
  firstColumn: string;
}) {
  return (
    <table className="w-full min-w-[420px] text-[13px] leading-5">
      <thead className="bg-surface text-left text-muted-foreground">
        <tr>
          <th scope="col" className="px-3 py-2 font-medium">
            {firstColumn}
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Target
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Achieved
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Attainment
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-border">
            <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
              {row.name}
            </th>
            <td className="px-3 py-2 text-right">
              <Money amount={row.target} />
            </td>
            <td className="px-3 py-2 text-right">
              <Money amount={row.achieved} />
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{percentText(row.attainmentPct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MonetaryLens({ data }: { data: MonetaryDashboard }) {
  const { totals, wonUnrealized, pipelineByKind, trend } = data;
  const open = pipelineByKind.find((k) => k.kind === 'open');
  const pipelineTotal = pipelineByKind.reduce((acc, k) => acc + k.count, 0);
  const noTargetMessage = 'No published target covers this period.';

  return (
    <div className="space-y-6">
      {data.isProRata && (
        <p className="text-[13px] text-muted-foreground">
          Monthly target is the quarter target ÷ 3 (pro-rata).
        </p>
      )}
      {!data.hasTarget && (
        <div
          role="status"
          className="rounded-md border border-border border-l-2 border-l-warning bg-background p-3 text-[13px] text-foreground"
        >
          {noTargetMessage} Attainment cannot be calculated until a target is published for{' '}
          {data.label}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Target"
          value={data.hasTarget ? <Money amount={totals.target} /> : '—'}
          context={data.label}
        />
        <KpiTile
          label="Achieved"
          value={<Money amount={totals.achieved} />}
          context="Money received in the period"
        />
        <KpiTile
          label="Attainment"
          value={percentText(totals.attainmentPct)}
          context="Achieved ÷ target"
        />
        <KpiTile
          label="Unachieved"
          value={data.hasTarget ? <Money amount={totals.unachieved} /> : '—'}
          context="Target not yet reached"
        />
        <KpiTile
          label="Over-achieved"
          value={data.hasTarget ? <Money amount={totals.overachieved} /> : '—'}
          context="Above target; not carried forward"
        />
        <KpiTile
          label="Won, not yet received"
          value={<Money amount={wonUnrealized.unrealized} />}
          context={
            <>
              Won <Money amount={wonUnrealized.won} /> · received{' '}
              <Money amount={wonUnrealized.received} />
            </>
          }
        />
        <KpiTile label="Leads" value={data.leadCount} context="Pipelines created in the period" />
        <KpiTile
          label="Open pipeline"
          value={<Money amount={open?.expected ?? 0} />}
          context={`${open?.count ?? 0} pipelines created in the period, not yet won`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Target vs achievement by member"
          description="Bar is money received; the marker is the target."
          compact
        >
          <AttainmentList
            rows={data.byMember}
            emptyMessage="No target or receipts for this period."
          />
          {data.byMember.length > 0 && (
            <ViewAsTable summary="View as table">
              <AttainmentTable rows={data.byMember} firstColumn="Member" />
            </ViewAsTable>
          )}
        </Card>
        <Card
          title="Target vs achievement by vertical"
          description="Vertical comes from each pipeline's category."
          compact
        >
          <AttainmentList
            rows={data.byVertical}
            emptyMessage="No target or receipts for this period."
          />
          {data.byVertical.length > 0 && (
            <ViewAsTable summary="View as table">
              <AttainmentTable rows={data.byVertical} firstColumn="Vertical" />
            </ViewAsTable>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Pipeline by stage kind"
          description={`Pipelines created in ${data.label}, grouped by their current stage.`}
          compact
        >
          <BarChart
            data={
              pipelineTotal === 0
                ? []
                : pipelineByKind.map((k) => ({
                    kind: KIND_LABELS[k.kind],
                    cash: k.cash,
                    inKind: k.inKind,
                  }))
            }
            xKey="kind"
            stacked
            series={[
              { key: 'cash', label: 'Cash', colorIndex: 0 },
              { key: 'inKind', label: 'Valued in-kind', colorIndex: 1 },
            ]}
            valueFormatter={formatCompactNumber}
            tooltipFormatter={(n) => formatMoney(n)}
            emptyMessage="No pipelines were created in this period."
          />
          <ViewAsTable summary="View as table">
            <table className="w-full min-w-[480px] text-[13px] leading-5">
              <thead className="bg-surface text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Stage kind
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Pipelines
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Expected
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Cash
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Valued in-kind
                  </th>
                </tr>
              </thead>
              <tbody>
                {pipelineByKind.map((k) => (
                  <tr key={k.kind} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                      {KIND_LABELS[k.kind]}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{k.count}</td>
                    <td className="px-3 py-2 text-right">
                      <Money amount={k.expected} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money amount={k.cash} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money amount={k.inKind} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ViewAsTable>
        </Card>

        <Card
          title="Achievement by month"
          description={`Money received each month of ${data.year}, for the selected member and vertical.`}
          compact
        >
          <LineChart
            data={trend.every((t) => t.achieved === 0) ? [] : trend}
            xKey="month"
            series={[{ key: 'achieved', label: 'Achieved', colorIndex: 0 }]}
            valueFormatter={formatCompactNumber}
            tooltipFormatter={(n) => formatMoney(n)}
            emptyMessage="No receipts were recorded this year."
          />
          <ViewAsTable summary="View as table">
            <table className="w-full min-w-[280px] text-[13px] leading-5">
              <thead className="bg-surface text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Month
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Achieved
                  </th>
                </tr>
              </thead>
              <tbody>
                {trend.map((t) => (
                  <tr key={t.month} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                      {t.month}
                    </th>
                    <td className="px-3 py-2 text-right">
                      <Money amount={t.achieved} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ViewAsTable>
        </Card>
      </div>

      {data.byMember.length === 0 && data.byVertical.length === 0 && pipelineTotal === 0 && (
        <EmptyState message="No data for this period. Change the period or clear the member and vertical filters." />
      )}
    </div>
  );
}
