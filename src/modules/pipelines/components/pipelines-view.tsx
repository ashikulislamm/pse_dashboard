'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import type { ContactLiteOption } from '@/modules/contacts';
import {
  Button,
  DataTable,
  type DataTableColumn,
  DatePicker,
  DateText,
  EmptyState,
  FilterBar,
  Input,
  KpiTile,
  Money,
  PageHeader,
  Select,
  Tag,
  TableSkeleton,
} from '@/shared/ui';
import type { AppRole } from '@/types/database';
import type { PipelineListItem, PipelineReferenceData } from '../repository';
import type { PipelineFilters } from '../schema';
import { canEditPipeline } from '../service';
import { PipelineForm } from './pipeline-form';
import { StageQuickSelect, stageKindTone } from './stage-transition-dialog';

export interface PipelinesViewProps {
  currentUser: { id: string; role: AppRole; full_name: string };
  pipelines: PipelineListItem[];
  referenceData: PipelineReferenceData;
  contactOptions: ContactLiteOption[];
  initialFilters: PipelineFilters;
  initialOpenCreate?: boolean;
  preselectedContactId?: string;
}

export function PipelinesView({
  currentUser,
  pipelines,
  referenceData,
  contactOptions,
  initialFilters,
  initialOpenCreate = false,
  preselectedContactId,
}: PipelinesViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [viewMode, setViewMode] = React.useState<'list' | 'board'>(
    initialFilters.view ?? 'list',
  );
  const [showCreateModal, setShowCreateModal] = React.useState(initialOpenCreate);

  const [q, setQ] = React.useState(initialFilters.q ?? '');
  const [stageId, setStageId] = React.useState(initialFilters.stageId ?? '');
  const [stageKind, setStageKind] = React.useState<string>(
    initialFilters.stageKind ?? '',
  );
  const [categoryId, setCategoryId] = React.useState(initialFilters.categoryId ?? '');
  const [focalPersonId, setFocalPersonId] = React.useState(
    initialFilters.focalPersonId ?? '',
  );
  const [partyType, setPartyType] = React.useState<string>(
    initialFilters.partyType ?? '',
  );
  const [contributionType, setContributionType] = React.useState<string>(
    initialFilters.contributionType ?? '',
  );
  const [fromDate, setFromDate] = React.useState(initialFilters.fromDate ?? '');
  const [toDate, setToDate] = React.useState(initialFilters.toDate ?? '');

  const preselectedContact = React.useMemo(
    () =>
      preselectedContactId
        ? contactOptions.find((c) => c.id === preselectedContactId)
        : undefined,
    [contactOptions, preselectedContactId],
  );

  const applyFilters = (overrides?: Partial<Record<string, string>>) => {
    const params = new URLSearchParams();
    const nextQ = overrides?.q !== undefined ? overrides.q : q;
    const nextStageId = overrides?.stageId !== undefined ? overrides.stageId : stageId;
    const nextStageKind =
      overrides?.stageKind !== undefined ? overrides.stageKind : stageKind;
    const nextCategoryId =
      overrides?.categoryId !== undefined ? overrides.categoryId : categoryId;
    const nextFocalPersonId =
      overrides?.focalPersonId !== undefined ? overrides.focalPersonId : focalPersonId;
    const nextPartyType =
      overrides?.partyType !== undefined ? overrides.partyType : partyType;
    const nextContributionType =
      overrides?.contributionType !== undefined
        ? overrides.contributionType
        : contributionType;
    const nextFromDate =
      overrides?.fromDate !== undefined ? overrides.fromDate : fromDate;
    const nextToDate = overrides?.toDate !== undefined ? overrides.toDate : toDate;
    const nextView = overrides?.view !== undefined ? overrides.view : viewMode;

    if (nextQ.trim()) params.set('q', nextQ.trim());
    if (nextStageId) params.set('stageId', nextStageId);
    if (nextStageKind) params.set('stageKind', nextStageKind);
    if (nextCategoryId) params.set('categoryId', nextCategoryId);
    if (nextFocalPersonId) params.set('focalPersonId', nextFocalPersonId);
    if (nextPartyType) params.set('partyType', nextPartyType);
    if (nextContributionType) params.set('contributionType', nextContributionType);
    if (nextFromDate) params.set('fromDate', nextFromDate);
    if (nextToDate) params.set('toDate', nextToDate);
    if (nextView === 'board') params.set('view', 'board');

    const qs = params.toString();
    startTransition(() => router.push(qs ? `/pipelines?${qs}` : '/pipelines'));
  };

  const resetFilters = () => {
    setQ('');
    setStageId('');
    setStageKind('');
    setCategoryId('');
    setFocalPersonId('');
    setPartyType('');
    setContributionType('');
    setFromDate('');
    setToDate('');
    startTransition(() => router.push(viewMode === 'board' ? '/pipelines?view=board' : '/pipelines'));
  };

  const hasActiveFilters = Boolean(
    q.trim() ||
      stageId ||
      stageKind ||
      categoryId ||
      focalPersonId ||
      partyType ||
      contributionType ||
      fromDate ||
      toDate,
  );

  const summaryStats = React.useMemo(() => {
    let openTotalBase = 0;
    let openCount = 0;
    let wonTotalBase = 0;
    let wonCount = 0;
    let realizedBase = 0;

    for (const p of pipelines) {
      realizedBase += p.received_amount_base;
      if (p.stage_kind === 'open') {
        openTotalBase += p.amount_base;
        openCount += 1;
      } else if (p.stage_kind === 'won') {
        wonTotalBase += p.amount_base;
        wonCount += 1;
      }
    }

    const wonUnrealizedBase = Math.max(0, wonTotalBase - realizedBase);

    return {
      openTotalBase,
      openCount,
      wonTotalBase,
      wonCount,
      realizedBase,
      wonUnrealizedBase,
    };
  }, [pipelines]);

  const columns = React.useMemo<DataTableColumn<PipelineListItem>[]>(
    () => [
      {
        key: 'deal_name',
        header: 'Deal / Opportunity',
        sortable: true,
        sortValue: (item) => item.deal_name.toLowerCase(),
        render: (item) => (
          <div className="min-w-[200px] py-1">
            <Link
              href={`/pipelines/${item.id}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {item.deal_name}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
              <span>
                {item.contribution_type === 'in_kind' ? 'In-kind (Valued)' : 'Cash'}
              </span>
              <span>·</span>
              <span className="capitalize">
                {item.payment_interval.replace('_', '-')}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'contact_name',
        header: 'Donor / Company',
        sortable: true,
        sortValue: (item) => item.contact_name.toLowerCase(),
        render: (item) => (
          <div className="min-w-[160px] py-1">
            <Link
              href={`/contacts/${item.contact_id}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {item.contact_name}
            </Link>
            {item.poc_contact_name && (
              <div className="text-[12px] text-muted-foreground">
                POC:{' '}
                {item.poc_contact_id ? (
                  <Link
                    href={`/contacts/${item.poc_contact_id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {item.poc_contact_name}
                  </Link>
                ) : (
                  item.poc_contact_name
                )}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'category_name',
        header: 'Category & Vertical',
        sortable: true,
        sortValue: (item) => item.category_name.toLowerCase(),
        render: (item) => (
          <div className="min-w-[150px] py-1">
            <div className="text-[13px] text-foreground">{item.category_name}</div>
            <div className="mt-0.5">
              <Tag>{item.vertical_name}</Tag>
            </div>
          </div>
        ),
      },
      {
        key: 'focal_person_name',
        header: 'Focal person',
        sortable: true,
        sortValue: (item) => item.focal_person_name.toLowerCase(),
        render: (item) => (
          <span className="text-[13px] text-muted-foreground">
            {item.focal_person_name}
          </span>
        ),
      },
      {
        key: 'stage_name',
        header: 'Stage',
        sortable: true,
        sortValue: (item) => item.stage_position,
        render: (item) => {
          const editable = canEditPipeline(currentUser, item);
          return (
            <StageQuickSelect
              pipelineId={item.id}
              dealName={item.deal_name}
              currentStageId={item.stage_id}
              currentStageName={item.stage_name}
              currentStageKind={item.stage_kind}
              stages={referenceData.stages}
              canEdit={editable}
            />
          );
        },
      },
      {
        key: 'amount_base',
        header: 'Expected value (BDT)',
        align: 'right',
        sortable: true,
        sortValue: (item) => item.amount_base,
        render: (item) => (
          <div className="py-1 text-right">
            <div className="font-medium text-foreground">
              <Money amount={item.amount_base} currency="BDT" />
            </div>
            {item.currency !== 'BDT' && (
              <div className="text-[12px] text-muted-foreground">
                <Money amount={item.expected_amount} currency={item.currency} />
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'received_amount_base',
        header: 'Realized receipts (BDT)',
        align: 'right',
        sortable: true,
        sortValue: (item) => item.received_amount_base,
        render: (item) => {
          if (item.stage_kind !== 'won' && item.received_amount_base === 0) {
            return (
              <div className="text-right text-[12px] text-subtle-foreground">—</div>
            );
          }
          const isOver = item.received_amount_base > item.amount_base + 0.005;
          return (
            <div className="py-1 text-right">
              <div className="font-medium text-foreground">
                <Money amount={item.received_amount_base} currency="BDT" />
              </div>
              <div className="text-[11px] text-muted-foreground">
                {item.receipt_count} receipt{item.receipt_count === 1 ? '' : 's'}
                {isOver ? ' · Over-received' : ''}
              </div>
            </div>
          );
        },
      },
      {
        key: 'expected_close',
        header: 'Expected close',
        sortable: true,
        sortValue: (item) => item.expected_close ?? '',
        render: (item) => <DateText value={item.expected_close} />,
      },
    ],
    [currentUser, referenceData.stages],
  );

  return (
    <div>
      <PageHeader
        title="Pipelines"
        description="Expected financial contributions, valued in-kind opportunities, stage history, and realized receipts."
        actions={
          <>
            <div
              role="group"
              aria-label="Pipeline view switcher"
              className="flex items-center rounded-sm border border-border bg-surface p-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  applyFilters({ view: 'list' });
                }}
                className={`flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[12px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
                  viewMode === 'list'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('board');
                  applyFilters({ view: 'board' });
                }}
                className={`flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[12px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
                  viewMode === 'board'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Board</span>
              </button>
            </div>

            <Button type="button" onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New pipeline
            </Button>
          </>
        }
      />

      {/* Summary KPI strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Open pipeline (expected)"
          value={<Money amount={summaryStats.openTotalBase} currency="BDT" />}
          context={`${summaryStats.openCount} active open deal${
            summaryStats.openCount === 1 ? '' : 's'
          }`}
        />
        <KpiTile
          label="Won committed value"
          value={<Money amount={summaryStats.wonTotalBase} currency="BDT" />}
          context={`${summaryStats.wonCount} won deal${
            summaryStats.wonCount === 1 ? '' : 's'
          }`}
        />
        <KpiTile
          label="Realized achievement (receipts)"
          value={<Money amount={summaryStats.realizedBase} currency="BDT" />}
          context="Sum of recorded pipeline receipts"
        />
        <KpiTile
          label="Won, not yet received"
          value={<Money amount={summaryStats.wonUnrealizedBase} currency="BDT" />}
          context="Won expected minus realized receipts"
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
              placeholder="Search deal or contact…"
              className="pl-8"
              aria-label="Search pipelines"
            />
          </div>

          <Select
            value={stageId}
            onChange={(e) => {
              setStageId(e.target.value);
              applyFilters({ stageId: e.target.value });
            }}
            className="w-44"
            aria-label="Filter by stage"
          >
            <option value="">All stages</option>
            {referenceData.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          <Select
            value={stageKind}
            onChange={(e) => {
              setStageKind(e.target.value);
              applyFilters({ stageKind: e.target.value });
            }}
            className="w-36"
            aria-label="Filter by stage status"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="junk">Abandoned / Junk</option>
          </Select>

          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              applyFilters({ categoryId: e.target.value });
            }}
            className="w-48"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {referenceData.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.vertical_name})
              </option>
            ))}
          </Select>

          <Select
            value={focalPersonId}
            onChange={(e) => {
              setFocalPersonId(e.target.value);
              applyFilters({ focalPersonId: e.target.value });
            }}
            className="w-44"
            aria-label="Filter by focal person"
          >
            <option value="">All focal people</option>
            {referenceData.focalPeople.map((fp) => (
              <option key={fp.id} value={fp.id}>
                {fp.full_name}
              </option>
            ))}
          </Select>

          <Select
            value={partyType}
            onChange={(e) => {
              setPartyType(e.target.value);
              applyFilters({ partyType: e.target.value });
            }}
            className="w-36"
            aria-label="Filter by party type"
          >
            <option value="">All parties</option>
            <option value="company">Company</option>
            <option value="individual">Individual</option>
          </Select>

          <Select
            value={contributionType}
            onChange={(e) => {
              setContributionType(e.target.value);
              applyFilters({ contributionType: e.target.value });
            }}
            className="w-36"
            aria-label="Filter by contribution type"
          >
            <option value="">Cash & In-kind</option>
            <option value="cash">Cash</option>
            <option value="in_kind">In-kind</option>
          </Select>

          <DatePicker
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              applyFilters({ fromDate: e.target.value });
            }}
            className="w-36"
            aria-label="Expected close from date"
            title="Expected close from date"
          />

          <DatePicker
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              applyFilters({ toDate: e.target.value });
            }}
            className="w-36"
            aria-label="Expected close to date"
            title="Expected close to date"
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

      {/* Main Content: List View vs Stage-Grouped Board View */}
      {viewMode === 'list' ? (
        <DataTable
          columns={columns}
          rows={pipelines}
          loading={isPending}
          getRowKey={(row) => row.id}
          emptyMessage={
            hasActiveFilters
              ? 'No pipelines match the current filters.'
              : 'No pipelines yet. Create the first one.'
          }
          emptyActionLabel={hasActiveFilters ? 'Reset filters' : 'New pipeline'}
          onEmptyAction={
            hasActiveFilters ? resetFilters : () => setShowCreateModal(true)
          }
        />
      ) : isPending ? (
        <TableSkeleton rows={6} columns={6} />
      ) : pipelines.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters
              ? 'No pipelines match the current filters.'
              : 'No pipelines yet. Create the first one.'
          }
          actionLabel={hasActiveFilters ? 'Reset filters' : 'New pipeline'}
          onAction={
            hasActiveFilters ? resetFilters : () => setShowCreateModal(true)
          }
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max items-start gap-4">
            {referenceData.stages.map((stage) => {
              const stageItems = pipelines.filter((p) => p.stage_id === stage.id);
              const stageSumBase = stageItems.reduce(
                (acc, p) => acc + p.amount_base,
                0,
              );

              return (
                <div
                  key={stage.id}
                  className="w-[304px] shrink-0 rounded-md border border-border bg-surface p-3"
                >
                  <div className="mb-3 border-b border-border pb-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-foreground">
                        {stage.name}
                      </span>
                      <Tag tone={stageKindTone(stage.kind)}>
                        {stageItems.length}
                      </Tag>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-muted-foreground">
                      <span>Total expected:</span>
                      <Money
                        amount={stageSumBase}
                        currency="BDT"
                        className="font-medium text-foreground"
                      />
                    </div>
                  </div>

                  {stageItems.length === 0 ? (
                    <div className="py-6 text-center text-[12px] text-subtle-foreground">
                      No deals in this stage
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {stageItems.map((item) => {
                        const editable = canEditPipeline(currentUser, item);
                        return (
                          <div
                            key={item.id}
                            className="rounded-sm border border-border bg-background p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/pipelines/${item.id}`}
                                className="text-[13px] leading-5 font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                {item.deal_name}
                              </Link>
                              <Tag className="shrink-0">{item.vertical_name}</Tag>
                            </div>

                            <div className="mt-1 text-[12px] text-muted-foreground">
                              <Link
                                href={`/contacts/${item.contact_id}`}
                                className="hover:text-foreground hover:underline"
                              >
                                {item.contact_name}
                              </Link>
                              {item.poc_contact_name
                                ? ` · POC: ${item.poc_contact_name}`
                                : ''}
                            </div>

                            <div className="mt-2.5 flex items-baseline justify-between border-t border-border pt-2">
                              <div>
                                <div className="text-[13px] font-semibold text-foreground">
                                  <Money amount={item.amount_base} currency="BDT" />
                                </div>
                                {item.stage_kind === 'won' && (
                                  <div className="text-[11px] text-muted-foreground">
                                    Received:{' '}
                                    <Money
                                      amount={item.received_amount_base}
                                      currency="BDT"
                                    />
                                  </div>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {item.focal_person_name}
                              </span>
                            </div>

                            <div className="mt-2.5 pt-1">
                              <StageQuickSelect
                                pipelineId={item.id}
                                dealName={item.deal_name}
                                currentStageId={item.stage_id}
                                currentStageName={item.stage_name}
                                currentStageKind={item.stage_kind}
                                stages={referenceData.stages}
                                canEdit={editable}
                                compact
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Pipeline Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-pipeline-dialog-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="w-full max-w-[720px] rounded-md border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2
                id="create-pipeline-dialog-title"
                className="text-[16px] leading-6 font-semibold text-foreground"
              >
                New pipeline opportunity
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[13px] text-muted-foreground hover:text-foreground outline-none focus:outline-none focus-visible:outline-none"
              >
                Close
              </button>
            </div>

            <PipelineForm
              mode="create"
              currentUserId={currentUser.id}
              referenceData={referenceData}
              contactOptions={contactOptions}
              initialValues={
                preselectedContact
                  ? {
                      party_type: preselectedContact.type,
                      contact_id: preselectedContact.id,
                    }
                  : undefined
              }
              onSuccess={(newId) => {
                setShowCreateModal(false);
                router.push(`/pipelines/${newId}`);
                router.refresh();
              }}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
