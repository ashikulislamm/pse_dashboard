'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Edit2, Plus, Search, UserCheck, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ContactLiteOption } from '@/modules/contacts';
import type { MeetingLiteOption } from '@/modules/meetings';
import type { PipelineLiteOption } from '@/modules/pipelines';
import {
  AutoLinkedNotes,
  Button,
  DataTable,
  type DataTableColumn,
  DatePicker,
  DateText,
  FilterBar,
  Input,
  KpiTile,
  PageHeader,
  Select,
  Tag,
} from '@/shared/ui';
import type {
  ActivityClass,
  ActivityStatus,
  ActivityType,
  AppRole,
} from '@/types/database';
import { updateActivityStatusAction } from '../actions';
import type { ActivityListItem, ActivityOwnerOption } from '../repository';
import type { ActivityFilters } from '../schema';
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  canEditActivity,
} from '../service';
import { ActivityForm } from './activity-form';

export interface ActivitiesViewProps {
  currentUser: { id: string; role: AppRole; full_name: string };
  activities: ActivityListItem[];
  owners: ActivityOwnerOption[];
  contactOptions: ContactLiteOption[];
  pipelineOptions: PipelineLiteOption[];
  meetingOptions: MeetingLiteOption[];
  initialFilters: ActivityFilters;
  initialOpenCreate?: boolean;
  preselectedContactId?: string;
  preselectedPipelineId?: string;
  preselectedMeetingId?: string;
  preselectedTitle?: string;
}

const CLASS_BADGE_LABELS: Record<ActivityClass, string> = {
  stewardship: 'Stewardship',
  prospect_engagement: 'Prospect engagement',
  independent: 'Independent',
};

export function ActivitiesView({
  currentUser,
  activities,
  owners,
  contactOptions,
  pipelineOptions,
  meetingOptions,
  initialFilters,
  initialOpenCreate = false,
  preselectedContactId,
  preselectedPipelineId,
  preselectedMeetingId,
  preselectedTitle,
}: ActivitiesViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [showCreateModal, setShowCreateModal] = React.useState(initialOpenCreate);
  const [editingActivity, setEditingActivity] =
    React.useState<ActivityListItem | null>(null);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const [q, setQ] = React.useState(initialFilters.q ?? '');
  const [typeFilter, setTypeFilter] = React.useState<string>(
    initialFilters.type ?? '',
  );
  const [classFilter, setClassFilter] = React.useState<string>(
    initialFilters.class ?? '',
  );
  const [statusFilter, setStatusFilter] = React.useState<string>(
    initialFilters.status ?? '',
  );
  const [ownerId, setOwnerId] = React.useState(initialFilters.ownerId ?? '');
  const [fromDate, setFromDate] = React.useState(initialFilters.fromDate ?? '');
  const [toDate, setToDate] = React.useState(initialFilters.toDate ?? '');

  const isMyActivitiesActive = ownerId === currentUser.id;

  const applyFilters = (overrides?: Partial<Record<string, string>>) => {
    const params = new URLSearchParams();
    const nextQ = overrides?.q !== undefined ? overrides.q : q;
    const nextType = overrides?.type !== undefined ? overrides.type : typeFilter;
    const nextClass =
      overrides?.class !== undefined ? overrides.class : classFilter;
    const nextStatus =
      overrides?.status !== undefined ? overrides.status : statusFilter;
    const nextOwnerId =
      overrides?.ownerId !== undefined ? overrides.ownerId : ownerId;
    const nextFromDate =
      overrides?.fromDate !== undefined ? overrides.fromDate : fromDate;
    const nextToDate = overrides?.toDate !== undefined ? overrides.toDate : toDate;

    if (nextQ.trim()) params.set('q', nextQ.trim());
    if (nextType) params.set('type', nextType);
    if (nextClass) params.set('class', nextClass);
    if (nextStatus) params.set('status', nextStatus);
    if (nextOwnerId) params.set('ownerId', nextOwnerId);
    if (nextFromDate) params.set('fromDate', nextFromDate);
    if (nextToDate) params.set('toDate', nextToDate);

    const qs = params.toString();
    startTransition(() => router.push(qs ? `/activities?${qs}` : '/activities'));
  };

  const resetFilters = () => {
    setQ('');
    setTypeFilter('');
    setClassFilter('');
    setStatusFilter('');
    setOwnerId('');
    setFromDate('');
    setToDate('');
    startTransition(() => router.push('/activities'));
  };

  const hasActiveFilters = Boolean(
    q.trim() ||
      typeFilter ||
      classFilter ||
      statusFilter ||
      ownerId ||
      fromDate ||
      toDate,
  );

  const summaryStats = React.useMemo(() => {
    let stewardshipCount = 0;
    let prospectCount = 0;
    let independentCount = 0;

    for (const a of activities) {
      if (a.class === 'stewardship') stewardshipCount += 1;
      else if (a.class === 'prospect_engagement') prospectCount += 1;
      else independentCount += 1;
    }

    return {
      total: activities.length,
      stewardshipCount,
      prospectCount,
      independentCount,
    };
  }, [activities]);

  const handleStatusChange = React.useCallback(
    async (activity: ActivityListItem, nextStatus: ActivityStatus) => {
      if (nextStatus === activity.status) return;
      setUpdatingId(activity.id);
      try {
        const res = await updateActivityStatusAction(activity.id, nextStatus);
        if (res.status === 'error') {
          toast.error(res.message);
          return;
        }
        toast.success(
          `Activity status updated to ${ACTIVITY_STATUS_LABELS[nextStatus]}.`,
        );
        router.refresh();
      } finally {
        setUpdatingId(null);
      }
    },
    [router],
  );

  // Excel tracker columns: Date | Title & Notes | Type | Class | Related | Owner | Status | Remaining work | Actions
  const columns = React.useMemo<DataTableColumn<ActivityListItem>[]>(
    () => [
      {
        key: 'date',
        header: 'Date',
        sortable: true,
        sortValue: (row) => row.occurred_at ?? row.due_at ?? row.created_at,
        render: (row) => (
          <div className="min-w-[110px] py-1">
            <DateText
              value={row.occurred_at ?? row.due_at ?? row.created_at}
              className="font-medium text-foreground"
            />
            {row.due_at && row.occurred_at && (
              <div className="text-[11px] text-muted-foreground">
                Due: <DateText value={row.due_at} />
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'title',
        header: 'Activity & notes',
        sortable: true,
        sortValue: (row) => row.title.toLowerCase(),
        render: (row) => (
          <div className="min-w-[210px] max-w-[300px] py-1">
            <div className="font-medium text-foreground">{row.title}</div>
            {row.meeting_id && (
              <div className="mt-0.5 text-[11px] text-primary">
                Follow-up to meeting (
                <DateText value={row.meeting_scheduled_at} />)
              </div>
            )}
            {row.notes && (
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                <AutoLinkedNotes
                  text={row.notes}
                  className="line-clamp-2 text-[12px]"
                />
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        sortValue: (row) => row.type,
        render: (row) => (
          <span className="text-[13px] text-foreground">
            {ACTIVITY_TYPE_LABELS[row.type]}
          </span>
        ),
      },
      {
        key: 'class',
        header: 'Class',
        sortable: true,
        sortValue: (row) => row.class,
        render: (row) => <Tag>{CLASS_BADGE_LABELS[row.class]}</Tag>,
      },
      {
        key: 'related',
        header: 'Related (Contact / Org / Pipeline)',
        sortable: true,
        sortValue: (row) =>
          (
            row.contact_name ??
            row.related_org_name ??
            row.pipeline_deal_name ??
            ''
          ).toLowerCase(),
        render: (row) => {
          const hasAny =
            row.effective_contact_id ||
            row.pipeline_id ||
            row.related_org_name ||
            row.derived_org_name;

          if (!hasAny) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <div className="min-w-[180px] py-1 text-[13px]">
              {row.effective_contact_id && row.contact_name && (
                <div>
                  <Link
                    href={`/contacts/${row.effective_contact_id}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {row.contact_name}
                  </Link>
                  {row.derived_org_name &&
                    row.derived_org_name !== row.contact_name && (
                      <span className="text-[12px] text-muted-foreground">
                        {' '}
                        · {row.derived_org_name}
                      </span>
                    )}
                </div>
              )}

              {!row.effective_contact_id && row.related_org_name && (
                <div className="font-medium text-foreground">
                  {row.related_org_name}
                </div>
              )}

              {row.pipeline_id && row.pipeline_deal_name && (
                <div className="text-[12px]">
                  <Link
                    href={`/pipelines/${row.pipeline_id}`}
                    className="text-primary hover:underline"
                  >
                    Pipeline: {row.pipeline_deal_name}
                  </Link>
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: 'owner_name',
        header: 'Owner',
        sortable: true,
        sortValue: (row) => row.owner_name.toLowerCase(),
        render: (row) => (
          <span className="text-[13px] text-muted-foreground">{row.owner_name}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (row) => row.status,
        render: (row) => {
          const editable = canEditActivity(currentUser, row);
          if (!editable) {
            return (
              <Tag
                tone={
                  row.status === 'done'
                    ? 'positive'
                    : row.status === 'cancelled'
                      ? 'negative'
                      : 'neutral'
                }
              >
                {ACTIVITY_STATUS_LABELS[row.status]}
              </Tag>
            );
          }

          return (
            <Select
              value={row.status}
              disabled={updatingId === row.id}
              onChange={(e) =>
                void handleStatusChange(row, e.target.value as ActivityStatus)
              }
              aria-label={`Change status for ${row.title}`}
              className="h-7 min-w-[122px] px-2 py-0.5 text-[12px] font-medium"
            >
              {(Object.keys(ACTIVITY_STATUS_LABELS) as ActivityStatus[]).map((st) => (
                <option key={st} value={st}>
                  {ACTIVITY_STATUS_LABELS[st]}
                </option>
              ))}
            </Select>
          );
        },
      },
      {
        key: 'remaining_work',
        header: 'Remaining work',
        render: (row) => (
          <div className="min-w-[180px] max-w-[260px] py-1 text-[13px] text-muted-foreground">
            {row.remaining_work || '—'}
          </div>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row) => {
          const editable = canEditActivity(currentUser, row);
          if (!editable) return null;
          return (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => setEditingActivity(row)}
              aria-label={`Edit ${row.title}`}
            >
              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          );
        },
      },
    ],
    [currentUser, updatingId, handleStatusChange],
  );

  return (
    <div>
      <PageHeader
        title="Activities"
        description="Non-monetary engagement tracker (stewardship, prospect engagement, independent outreach, follow-up tasks, and unvalued items)."
        actions={
          <>
            <div
              role="group"
              aria-label="Activity owner preset"
              className="flex items-center rounded-sm border border-border bg-surface p-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  setOwnerId('');
                  applyFilters({ ownerId: '' });
                }}
                className={`flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[12px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
                  !isMyActivitiesActive
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>All team</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnerId(currentUser.id);
                  applyFilters({ ownerId: currentUser.id });
                }}
                className={`flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[12px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
                  isMyActivitiesActive
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>My activities</span>
              </button>
            </div>

            <Button type="button" onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Log activity
            </Button>
          </>
        }
      />

      {/* Non-monetary KPI summary strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total activities"
          value={summaryStats.total}
          context="Matching current filter criteria"
        />
        <KpiTile
          label="Stewardship"
          value={summaryStats.stewardshipCount}
          context="Existing donor servicing & retention"
        />
        <KpiTile
          label="Prospect engagement"
          value={summaryStats.prospectCount}
          context="Pre-pipeline relationship building"
        />
        <KpiTile
          label="Independent"
          value={summaryStats.independentCount}
          context="Events, visits, tasks & unvalued items"
        />
      </div>

      {/* Filter Bar */}
      <FilterBar>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative w-56">
            <Search
              className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, org, or work…"
              className="pl-8"
              aria-label="Search activities"
            />
          </div>

          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              applyFilters({ type: e.target.value });
            }}
            className="w-44"
            aria-label="Filter by activity type"
          >
            <option value="">All 11 types</option>
            {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>

          <Select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              applyFilters({ class: e.target.value });
            }}
            className="w-44"
            aria-label="Filter by activity class"
          >
            <option value="">All 3 classes</option>
            <option value="stewardship">Stewardship</option>
            <option value="prospect_engagement">Prospect engagement</option>
            <option value="independent">Independent</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              applyFilters({ status: e.target.value });
            }}
            className="w-36"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {(Object.keys(ACTIVITY_STATUS_LABELS) as ActivityStatus[]).map((st) => (
              <option key={st} value={st}>
                {ACTIVITY_STATUS_LABELS[st]}
              </option>
            ))}
          </Select>

          <Select
            value={ownerId}
            onChange={(e) => {
              setOwnerId(e.target.value);
              applyFilters({ ownerId: e.target.value });
            }}
            className="w-44"
            aria-label="Filter by owner"
          >
            <option value="">All owners</option>
            {owners.map((ow) => (
              <option key={ow.id} value={ow.id}>
                {ow.full_name}
              </option>
            ))}
          </Select>

          <DatePicker
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              applyFilters({ fromDate: e.target.value });
            }}
            className="w-36"
            aria-label="From date"
            title="From date"
          />

          <DatePicker
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              applyFilters({ toDate: e.target.value });
            }}
            className="w-36"
            aria-label="To date"
            title="To date"
          />

          <Button type="submit" variant="secondary" size="compact">
            Apply
          </Button>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={resetFilters}
            >
              <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Reset
            </Button>
          )}
        </form>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={activities}
        loading={isPending}
        getRowKey={(row) => row.id}
        emptyMessage={
          hasActiveFilters
            ? 'No activities match the current filters.'
            : 'No activities logged yet. Log the first one.'
        }
        emptyActionLabel={hasActiveFilters ? 'Reset filters' : 'Log activity'}
        onEmptyAction={
          hasActiveFilters ? resetFilters : () => setShowCreateModal(true)
        }
      />

      {/* Create Activity Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-activity-dialog-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="w-full max-w-[680px] rounded-md border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2
                id="create-activity-dialog-title"
                className="text-[16px] leading-6 font-semibold text-foreground"
              >
                Log activity
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[13px] text-muted-foreground hover:text-foreground outline-none focus:outline-none focus-visible:outline-none"
              >
                Close
              </button>
            </div>

            <ActivityForm
              mode="create"
              currentUserId={currentUser.id}
              owners={owners}
              contactOptions={contactOptions}
              pipelineOptions={pipelineOptions}
              meetingOptions={meetingOptions}
              initialValues={{
                title: preselectedTitle ?? '',
                contact_id: preselectedContactId ?? null,
                pipeline_id: preselectedPipelineId ?? null,
                meeting_id: preselectedMeetingId ?? null,
                owner_id: currentUser.id,
              }}
              onSuccess={() => {
                setShowCreateModal(false);
                router.refresh();
              }}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-activity-dialog-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingActivity(null);
            }
          }}
        >
          <div className="w-full max-w-[680px] rounded-md border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2
                id="edit-activity-dialog-title"
                className="text-[16px] leading-6 font-semibold text-foreground"
              >
                Edit activity: {editingActivity.title}
              </h2>
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                className="text-[13px] text-muted-foreground hover:text-foreground outline-none focus:outline-none focus-visible:outline-none"
              >
                Close
              </button>
            </div>

            <ActivityForm
              mode="edit"
              activityId={editingActivity.id}
              currentUserId={currentUser.id}
              owners={owners}
              contactOptions={contactOptions}
              pipelineOptions={pipelineOptions}
              meetingOptions={meetingOptions}
              initialValues={{
                title: editingActivity.title,
                type: editingActivity.type,
                class: editingActivity.class,
                owner_id: editingActivity.owner_id,
                contact_id: editingActivity.contact_id,
                pipeline_id: editingActivity.pipeline_id,
                meeting_id: editingActivity.meeting_id,
                related_org_name: editingActivity.related_org_name,
                status: editingActivity.status,
                remaining_work: editingActivity.remaining_work,
                occurred_at: editingActivity.occurred_at,
                due_at: editingActivity.due_at,
                notes: editingActivity.notes,
              }}
              onSuccess={() => {
                setEditingActivity(null);
                router.refresh();
              }}
              onCancel={() => setEditingActivity(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
