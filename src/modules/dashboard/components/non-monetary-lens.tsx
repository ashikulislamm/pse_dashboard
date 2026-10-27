import * as React from 'react';
import { ACTIVITY_TYPE_LABELS } from '@/modules/activities';
import { BarChart, Card, EmptyState, KpiTile } from '@/shared/ui';
import {
  ACTIVITY_CLASS_LABELS,
  activitiesHref,
  meetingsHref,
  type NonMonetaryDashboard,
} from '../service';

function percentText(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

export function NonMonetaryLens({
  data,
  member,
}: {
  data: NonMonetaryDashboard;
  member: string | null;
}) {
  const { meetings, activities, workload } = data;
  const stewardship = activities.byClass.find((c) => c.class === 'stewardship')?.count ?? 0;
  const window = { start: data.start, end: data.end };
  const isEmpty = meetings.total === 0 && activities.total === 0;

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-muted-foreground">
        Meetings and activities never change the monetary figures. Cancelled activities are not
        counted.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Meetings"
          value={meetings.total}
          context={`${meetings.scheduled} scheduled · ${meetings.done} done`}
          href={meetingsHref(window, member)}
        />
        <KpiTile
          label="Meeting completion"
          value={percentText(meetings.completionPct)}
          context="Done ÷ all meetings in the period"
        />
        <KpiTile
          label="Activities"
          value={activities.total}
          context="All types, excluding cancelled"
          href={activitiesHref(window, member)}
        />
        <KpiTile
          label="Contacts engaged"
          value={data.contactsEngaged}
          context="Distinct contacts in activities or meetings"
        />
        <KpiTile
          label="Visits"
          value={data.visits}
          href={activitiesHref(window, member, { type: 'visit' })}
        />
        <KpiTile
          label="Events"
          value={data.events}
          href={activitiesHref(window, member, { type: 'event' })}
        />
        <KpiTile
          label="Campaigns"
          value={data.campaigns}
          href={activitiesHref(window, member, { type: 'campaign' })}
        />
        <KpiTile
          label="Stewardship activities"
          value={stewardship}
          context="Work with existing donors"
          href={activitiesHref(window, member, { class: 'stewardship' })}
        />
      </div>

      {isEmpty ? (
        <EmptyState message="No meetings or activities in this period. Change the period or clear the member filter." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Activities by type" description={`In ${data.label}.`} compact>
              <BarChart
                data={activities.byType.map((t) => ({
                  type: ACTIVITY_TYPE_LABELS[t.type],
                  count: t.count,
                }))}
                xKey="type"
                series={[{ key: 'count', label: 'Activities', colorIndex: 0 }]}
                emptyMessage="No activities in this period."
              />
              <details className="mt-4 text-[13px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View as table
                </summary>
                <table className="mt-2 w-full text-[13px] leading-5">
                  <thead className="bg-surface text-left text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Type
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Activities
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.byType.map((t) => (
                      <tr key={t.type} className="border-t border-border">
                        <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                          {ACTIVITY_TYPE_LABELS[t.type]}
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums">{t.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Card>

            <Card
              title="Activities by class"
              description="Stewardship is existing donors; prospect engagement is before a money opportunity exists."
              compact
            >
              <table className="w-full text-[13px] leading-5">
                <thead className="bg-surface text-left text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Class
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Activities
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activities.byClass.map((c) => (
                    <tr key={c.class} className="border-t border-border">
                      <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                        <a
                          href={activitiesHref(window, member, { class: c.class })}
                          className="underline-offset-4 hover:underline"
                        >
                          {ACTIVITY_CLASS_LABELS[c.class]}
                        </a>
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <Card
            title="Workload by member"
            description="Meetings and activities owned by each active PSE member."
            compact
          >
            <BarChart
              data={workload.map((w) => ({
                member: w.name,
                meetings: w.meetings,
                activities: w.activities,
              }))}
              xKey="member"
              stacked
              series={[
                { key: 'meetings', label: 'Meetings', colorIndex: 0 },
                { key: 'activities', label: 'Activities', colorIndex: 1 },
              ]}
              emptyMessage="No active PSE members."
            />
            <details className="mt-4 text-[13px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View as table
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[320px] text-[13px] leading-5">
                  <thead className="bg-surface text-left text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Member
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Meetings
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Activities
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.map((w) => (
                      <tr key={w.id} className="border-t border-border">
                        <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                          {w.name}
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums">{w.meetings}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{w.activities}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
        </>
      )}
    </div>
  );
}
