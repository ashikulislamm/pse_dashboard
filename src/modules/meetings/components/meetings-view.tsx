'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Edit2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ContactLiteOption } from '@/modules/contacts';
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
import type { AppRole, MeetingStatus } from '@/types/database';
import { updateMeetingStatusAction } from '../actions';
import type { MeetingListItem, MeetingOwnerOption } from '../repository';
import type { MeetingFilters } from '../schema';
import { canEditMeeting } from '../service';
import { MeetingForm } from './meeting-form';

export interface MeetingsViewProps {
  currentUser: { id: string; role: AppRole; full_name: string };
  meetings: MeetingListItem[];
  owners: MeetingOwnerOption[];
  contactOptions: ContactLiteOption[];
  pipelineOptions: PipelineLiteOption[];
  initialFilters: MeetingFilters;
  initialOpenCreate?: boolean;
  preselectedContactId?: string;
  preselectedPipelineId?: string;
}

export function MeetingsView({
  currentUser,
  meetings,
  owners,
  contactOptions,
  pipelineOptions,
  initialFilters,
  initialOpenCreate = false,
  preselectedContactId,
  preselectedPipelineId,
}: MeetingsViewProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = React.useState(initialOpenCreate);
  const [editingMeeting, setEditingMeeting] = React.useState<MeetingListItem | null>(
    null,
  );
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const [q, setQ] = React.useState(initialFilters.q ?? '');
  const [statusTab, setStatusTab] = React.useState<'' | MeetingStatus>(
    initialFilters.status ?? '',
  );
  const [ownerId, setOwnerId] = React.useState(initialFilters.ownerId ?? '');
  const [fromDate, setFromDate] = React.useState(initialFilters.fromDate ?? '');
  const [toDate, setToDate] = React.useState(initialFilters.toDate ?? '');

  const applyFilters = (overrides?: Partial<Record<string, string>>) => {
    const params = new URLSearchParams();
    const nextQ = overrides?.q !== undefined ? overrides.q : q;
    const nextStatus =
      overrides?.status !== undefined ? overrides.status : statusTab;
    const nextOwnerId =
      overrides?.ownerId !== undefined ? overrides.ownerId : ownerId;
    const nextFromDate =
      overrides?.fromDate !== undefined ? overrides.fromDate : fromDate;
    const nextToDate = overrides?.toDate !== undefined ? overrides.toDate : toDate;

    if (nextQ.trim()) params.set('q', nextQ.trim());
    if (nextStatus) params.set('status', nextStatus);
    if (nextOwnerId) params.set('ownerId', nextOwnerId);
    if (nextFromDate) params.set('fromDate', nextFromDate);
    if (nextToDate) params.set('toDate', nextToDate);

    const qs = params.toString();
    router.push(qs ? `/meetings?${qs}` : '/meetings');
  };

  const resetFilters = () => {
    setQ('');
    setStatusTab('');
    setOwnerId('');
    setFromDate('');
    setToDate('');
    router.push('/meetings');
  };

  const hasActiveFilters = Boolean(
    q.trim() || statusTab || ownerId || fromDate || toDate,
  );

  const summaryStats = React.useMemo(() => {
    let scheduledCount = 0;
    let doneCount = 0;
    let withFollowupCount = 0;

    for (const m of meetings) {
      if (m.status === 'scheduled') scheduledCount += 1;
      if (m.status === 'done') doneCount += 1;
      if (m.followup_count > 0) withFollowupCount += 1;
    }

    return {
      total: meetings.length,
      scheduledCount,
      doneCount,
      withFollowupCount,
    };
  }, [meetings]);

  const handleToggleStatus = React.useCallback(
    async (meeting: MeetingListItem, nextStatus: MeetingStatus) => {
      setUpdatingId(meeting.id);
      try {
        const res = await updateMeetingStatusAction(meeting.id, nextStatus);
        if (res.status === 'error') {
          toast.error(res.message);
          return;
        }
        toast.success(
          nextStatus === 'done'
            ? 'Meeting marked as Done.'
            : 'Meeting moved back to Scheduled.',
        );
        router.refresh();
      } finally {
        setUpdatingId(null);
      }
    },
    [router],
  );

  const columns = React.useMemo<DataTableColumn<MeetingListItem>[]>(
    () => [
      {
        key: 'scheduled_at',
        header: 'Scheduled date & time',
        sortable: true,
        sortValue: (row) => row.scheduled_at,
        render: (row) => (
          <div className="min-w-[155px] py-1">
            <DateText
              value={row.scheduled_at}
              includeTime
              className="font-medium text-foreground"
            />
          </div>
        ),
      },
      {
        key: 'contact_name',
        header: 'Contact & derived organization / role',
        sortable: true,
        sortValue: (row) => (row.contact_name ?? '').toLowerCase(),
        render: (row) => (
          <div className="min-w-[200px] py-1">
            {row.effective_contact_id && row.contact_name ? (
              <Link
                href={`/contacts/${row.effective_contact_id}`}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {row.contact_name}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            {(row.derived_designation || row.derived_organization_name) && (
              <div className="text-[12px] text-muted-foreground">
                {[row.derived_designation, row.derived_organization_name]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'pipeline_deal_name',
        header: 'Linked pipeline',
        sortable: true,
        sortValue: (row) => (row.pipeline_deal_name ?? '').toLowerCase(),
        render: (row) =>
          row.pipeline_id && row.pipeline_deal_name ? (
            <div className="min-w-[170px] py-1">
              <Link
                href={`/pipelines/${row.pipeline_id}`}
                className="font-medium text-primary hover:underline"
              >
                {row.pipeline_deal_name}
              </Link>
              {row.pipeline_stage_name && (
                <div className="mt-0.5">
                  <Tag>{row.pipeline_stage_name}</Tag>
                </div>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'description',
        header: 'Agenda / outcome notes',
        render: (row) => (
          <div className="max-w-[320px] py-1 text-[13px]">
            <AutoLinkedNotes
              text={row.description}
              className="line-clamp-2 text-[13px]"
            />
          </div>
        ),
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
        render: (row) => (
          <Tag tone={row.status === 'done' ? 'positive' : 'neutral'}>
            {row.status === 'done' ? 'Done' : 'Scheduled'}
          </Tag>
        ),
      },
      {
        key: 'actions',
        header: 'Follow-up & actions',
        align: 'right',
        render: (row) => {
          const editable = canEditMeeting(currentUser, row);
          const followupTitle = `Follow-up: ${
            row.contact_name ?? row.pipeline_deal_name ?? 'Meeting'
          }`;
          const followupParams = new URLSearchParams({
            new: '1',
            meetingId: row.id,
            title: followupTitle,
          });
          if (row.effective_contact_id) {
            followupParams.set('contactId', row.effective_contact_id);
          }
          if (row.pipeline_id) {
            followupParams.set('pipelineId', row.pipeline_id);
          }

          return (
            <div className="flex items-center justify-end gap-1.5 py-1">
              {editable && row.status === 'scheduled' && (
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={updatingId === row.id}
                  onClick={() => void handleToggleStatus(row, 'done')}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mark done</span>
                </Button>
              )}

              <Link href={`/activities?${followupParams.toString()}`}>
                <Button type="button" variant="secondary" size="compact">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Add follow-up
                    {row.followup_count > 0 ? ` (${row.followup_count})` : ''}
                  </span>
                </Button>
              </Link>

              {editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  onClick={() => setEditingMeeting(row)}
                  aria-label="Edit meeting"
                >
                  <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [currentUser, updatingId, handleToggleStatus],
  );

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Structured donor and partner meetings linked to contacts or pipelines, with derived organization details and one-click follow-up activities."
        actions={
          <Button type="button" onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Schedule meeting
          </Button>
        }
      />

      {/* Summary KPI strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total meetings"
          value={summaryStats.total}
          context="Matching current filter criteria"
        />
        <KpiTile
          label="Scheduled (upcoming)"
          value={summaryStats.scheduledCount}
          context="Status = Scheduled"
        />
        <KpiTile
          label="Completed"
          value={summaryStats.doneCount}
          context="Status = Done"
        />
        <KpiTile
          label="With follow-up activity"
          value={summaryStats.withFollowupCount}
          context="Meetings linked to >= 1 follow-up activity"
        />
      </div>

      {/* Status Tabs (All / Scheduled / Done) */}
      <div className="mb-4 flex items-center gap-4 border-b border-border">
        <button
          type="button"
          onClick={() => {
            setStatusTab('');
            applyFilters({ status: '' });
          }}
          className={`-mb-px border-b-2 pb-2.5 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
            statusTab === ''
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All meetings
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusTab('scheduled');
            applyFilters({ status: 'scheduled' });
          }}
          className={`-mb-px border-b-2 pb-2.5 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
            statusTab === 'scheduled'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Upcoming / Scheduled
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusTab('done');
            applyFilters({ status: 'done' });
          }}
          className={`-mb-px border-b-2 pb-2.5 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
            statusTab === 'done'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Done
        </button>
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
          <div className="relative w-60">
            <Search
              className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contact, company, or notes…"
              className="pl-8"
              aria-label="Search meetings"
            />
          </div>

          <Select
            value={ownerId}
            onChange={(e) => {
              setOwnerId(e.target.value);
              applyFilters({ ownerId: e.target.value });
            }}
            className="w-48"
            aria-label="Filter by meeting owner"
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
            aria-label="Scheduled from date"
            title="Scheduled from date"
          />

          <DatePicker
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              applyFilters({ toDate: e.target.value });
            }}
            className="w-36"
            aria-label="Scheduled to date"
            title="Scheduled to date"
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
        rows={meetings}
        getRowKey={(row) => row.id}
        emptyMessage={
          hasActiveFilters
            ? 'No meetings match the current filters.'
            : 'No meetings yet. Schedule the first one.'
        }
        emptyActionLabel={hasActiveFilters ? 'Reset filters' : 'Schedule meeting'}
        onEmptyAction={
          hasActiveFilters ? resetFilters : () => setShowCreateModal(true)
        }
      />

      {/* Schedule Meeting Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-meeting-dialog-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="w-full max-w-[640px] rounded-md border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2
                id="create-meeting-dialog-title"
                className="text-[16px] leading-6 font-semibold text-foreground"
              >
                Schedule meeting
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[13px] text-muted-foreground hover:text-foreground outline-none focus:outline-none focus-visible:outline-none"
              >
                Close
              </button>
            </div>

            <MeetingForm
              mode="create"
              currentUserId={currentUser.id}
              owners={owners}
              contactOptions={contactOptions}
              pipelineOptions={pipelineOptions}
              initialValues={{
                contact_id: preselectedContactId ?? null,
                pipeline_id: preselectedPipelineId ?? null,
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

      {/* Edit Meeting Modal */}
      {editingMeeting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-meeting-dialog-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingMeeting(null);
            }
          }}
        >
          <div className="w-full max-w-[640px] rounded-md border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2
                id="edit-meeting-dialog-title"
                className="text-[16px] leading-6 font-semibold text-foreground"
              >
                Edit meeting
              </h2>
              <button
                type="button"
                onClick={() => setEditingMeeting(null)}
                className="text-[13px] text-muted-foreground hover:text-foreground outline-none focus:outline-none focus-visible:outline-none"
              >
                Close
              </button>
            </div>

            <MeetingForm
              mode="edit"
              meetingId={editingMeeting.id}
              currentUserId={currentUser.id}
              owners={owners}
              contactOptions={contactOptions}
              pipelineOptions={pipelineOptions}
              initialValues={{
                contact_id: editingMeeting.contact_id,
                pipeline_id: editingMeeting.pipeline_id,
                scheduled_at: editingMeeting.scheduled_at,
                status: editingMeeting.status,
                owner_id: editingMeeting.owner_id,
                description: editingMeeting.description,
              }}
              onSuccess={() => {
                setEditingMeeting(null);
                router.refresh();
              }}
              onCancel={() => setEditingMeeting(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
