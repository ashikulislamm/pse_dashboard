'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Plus } from 'lucide-react';
import type { ContactLiteOption } from '@/modules/contacts';
import {
  AutoLinkedNotes,
  Button,
  DateText,
  EmptyState,
  Money,
  PageHeader,
  Tag,
  TargetBar,
} from '@/shared/ui';
import type { AppRole } from '@/types/database';
import type { PipelineDetailData, PipelineReferenceData } from '../repository';
import { canEditPipeline, computePipelineAchievementSummary } from '../service';
import { PipelineForm } from './pipeline-form';
import { RecordReceiptDialog } from './record-receipt-dialog';
import { StageQuickSelect, stageKindTone } from './stage-transition-dialog';

export interface PipelineDetailViewProps {
  currentUser: { id: string; role: AppRole; full_name: string };
  detail: PipelineDetailData;
  referenceData: PipelineReferenceData;
  contactOptions: ContactLiteOption[];
}

type RelatedTab = 'meetings' | 'activities';

export function PipelineDetailView({
  currentUser,
  detail,
  referenceData,
  contactOptions,
}: PipelineDetailViewProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<RelatedTab>('meetings');

  const { pipeline, stageHistory, receipts, meetings, activities } = detail;
  const editable = canEditPipeline(currentUser, pipeline);
  const isWon = pipeline.stage_kind === 'won';

  const achievementSummary = React.useMemo(
    () =>
      computePipelineAchievementSummary(
        pipeline.amount_base,
        pipeline.received_amount_base,
      ),
    [pipeline.amount_base, pipeline.received_amount_base],
  );

  return (
    <div>
      <div className="mb-3">
        <Link
          href="/pipelines"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Pipelines</span>
        </Link>
      </div>

      <PageHeader
        title={pipeline.deal_name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Tag tone={stageKindTone(pipeline.stage_kind)}>{pipeline.stage_name}</Tag>
            <Tag>
              {pipeline.contribution_type === 'in_kind' ? 'In-kind (Valued)' : 'Cash'}
            </Tag>
            <Tag>
              {pipeline.category_name} · {pipeline.vertical_name}
            </Tag>
            <span>·</span>
            <span>Focal person: {pipeline.focal_person_name}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StageQuickSelect
              pipelineId={pipeline.id}
              dealName={pipeline.deal_name}
              currentStageId={pipeline.stage_id}
              currentStageName={pipeline.stage_name}
              currentStageKind={pipeline.stage_kind}
              stages={referenceData.stages}
              canEdit={editable}
            />
            {editable && isWon && (
              <Button
                type="button"
                variant="primary"
                onClick={() => setReceiptDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Record receipt
              </Button>
            )}
            {editable && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(true)}
              >
                <Edit2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Edit pipeline
              </Button>
            )}
          </div>
        }
      />

      {/* Won, received and unrealized banner */}
      {(isWon || receipts.length > 0) && (
        <div className="mb-6 rounded-md border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[14px] leading-5 font-semibold text-foreground">
              <span>
                Won <Money amount={achievementSummary.expectedBase} currency="BDT" />
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                Received{' '}
                <Money amount={achievementSummary.receivedBase} currency="BDT" />
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                Unrealized{' '}
                <Money amount={achievementSummary.unrealizedBase} currency="BDT" />
              </span>
            </div>

            {achievementSummary.isOverReceived && (
              <Tag tone="positive">
                Over-received by{' '}
                <Money
                  amount={achievementSummary.overReceivedBase}
                  currency="BDT"
                  className="ml-1 font-semibold"
                />
              </Tag>
            )}
          </div>

          <div className="mt-3">
            <TargetBar
              label="Realized achievement (receipts) vs. Won expected value"
              achieved={achievementSummary.receivedBase}
              target={achievementSummary.expectedBase}
            />
          </div>
        </div>
      )}

      {/* Lost / Abandoned Reason Banner */}
      {(pipeline.stage_kind === 'lost' || pipeline.stage_kind === 'junk') &&
        pipeline.lost_reason && (
          <div className="mb-6 rounded-md border border-negative bg-negative-subtle p-4 text-[13px] text-negative">
            <span className="font-semibold">
              {pipeline.stage_kind === 'lost' ? 'Lost reason: ' : 'Abandoned note: '}
            </span>
            <span>{pipeline.lost_reason}</span>
          </div>
        )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Summary, Valuation Note, Notes & Stage History */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-md border border-border bg-background p-4">
            <h2 className="mb-3 text-[15px] font-semibold text-foreground">
              Opportunity summary
            </h2>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Expected value (BDT)</dt>
                <dd className="font-semibold text-foreground">
                  <Money amount={pipeline.amount_base} currency="BDT" />
                  {pipeline.currency !== 'BDT' && (
                    <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                      (
                      <Money
                        amount={pipeline.expected_amount}
                        currency={pipeline.currency}
                      />
                      )
                    </span>
                  )}
                </dd>
              </div>

              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">
                  {pipeline.party_type === 'company' ? 'Company' : 'Individual donor'}
                </dt>
                <dd className="text-right font-medium">
                  <Link
                    href={`/contacts/${pipeline.contact_id}`}
                    className="text-primary hover:underline"
                  >
                    {pipeline.contact_name}
                  </Link>
                  {pipeline.contact_designation && (
                    <div className="text-[12px] font-normal text-muted-foreground">
                      {pipeline.contact_designation}
                      {pipeline.contact_organization_name
                        ? ` · ${pipeline.contact_organization_name}`
                        : ''}
                    </div>
                  )}
                </dd>
              </div>

              {pipeline.party_type === 'company' && (
                <>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Point of Contact (POC)</dt>
                    <dd className="text-right font-medium">
                      {pipeline.poc_contact_id && pipeline.poc_contact_name ? (
                        <>
                          <Link
                            href={`/contacts/${pipeline.poc_contact_id}`}
                            className="text-primary hover:underline"
                          >
                            {pipeline.poc_contact_name}
                          </Link>
                          {pipeline.poc_designation && (
                            <div className="text-[12px] font-normal text-muted-foreground">
                              {pipeline.poc_designation}
                            </div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>

                  {pipeline.secondary_contact_id && pipeline.secondary_contact_name && (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Secondary contact</dt>
                      <dd className="text-right font-medium">
                        <Link
                          href={`/contacts/${pipeline.secondary_contact_id}`}
                          className="text-primary hover:underline"
                        >
                          {pipeline.secondary_contact_name}
                        </Link>
                        {pipeline.secondary_designation && (
                          <div className="text-[12px] font-normal text-muted-foreground">
                            {pipeline.secondary_designation}
                          </div>
                        )}
                      </dd>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Contribution category</dt>
                <dd className="text-right text-foreground">{pipeline.category_name}</dd>
              </div>

              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Reporting vertical</dt>
                <dd>
                  <Tag>{pipeline.vertical_name}</Tag>
                </dd>
              </div>

              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Payment interval</dt>
                <dd className="capitalize text-foreground">
                  {pipeline.payment_interval.replace('_', '-')}
                </dd>
              </div>

              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Expected close date</dt>
                <dd className="text-foreground">
                  <DateText value={pipeline.expected_close} />
                </dd>
              </div>

              {pipeline.won_at && (
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Committed (Won) at</dt>
                  <dd className="text-foreground">
                    <DateText value={pipeline.won_at} />
                  </dd>
                </div>
              )}

              {pipeline.operational_budget !== null && (
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Operational budget</dt>
                  <dd className="text-foreground">
                    <Money amount={pipeline.operational_budget} currency="BDT" />
                  </dd>
                </div>
              )}

              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-muted-foreground">Country</dt>
                <dd className="text-foreground">{pipeline.country || '—'}</dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">
                  <DateText value={pipeline.created_at} />
                </dd>
              </div>
            </dl>
          </div>

          {pipeline.contribution_type === 'in_kind' && (
            <div className="rounded-md border border-border bg-surface p-4">
              <h2 className="mb-1.5 text-[14px] font-semibold text-foreground">
                In-kind valuation note
              </h2>
              <p className="text-[13px] leading-5 text-foreground">
                {pipeline.in_kind_valuation_note || '—'}
              </p>
            </div>
          )}

          <div className="rounded-md border border-border bg-background p-4">
            <h2 className="mb-2 text-[15px] font-semibold text-foreground">
              Scope & documentation (Google Drive links)
            </h2>
            {pipeline.description && (
              <div className="mb-3 border-b border-border pb-3">
                <div className="mb-1 text-[12px] font-medium text-muted-foreground">
                  Proposal / scope description
                </div>
                <AutoLinkedNotes text={pipeline.description} />
              </div>
            )}
            <div>
              <div className="mb-1 text-[12px] font-medium text-muted-foreground">
                Notes & links
              </div>
              <AutoLinkedNotes text={pipeline.notes} />
            </div>
          </div>

          {/* Stage History Timeline */}
          <div className="rounded-md border border-border bg-background p-4">
            <h2 className="mb-3 text-[15px] font-semibold text-foreground">
              Stage history ({stageHistory.length})
            </h2>
            {stageHistory.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No stage transitions recorded yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {stageHistory.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-sm border border-border bg-surface px-3 py-2 text-[13px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {h.from_stage_name
                          ? `${h.from_stage_name} → ${h.to_stage_name}`
                          : `Created in ${h.to_stage_name}`}
                      </span>
                      <Tag tone={stageKindTone(h.to_stage_kind)}>
                        {h.to_stage_kind}
                      </Tag>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-muted-foreground">
                      <span>{h.changed_by_name ?? 'System'}</span>
                      <DateText value={h.changed_at} includeTime />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Right Column: Realized Receipts & Linked Meetings/Activities */}
        <div className="space-y-6 lg:col-span-7">
          {/* Realized Receipts Table */}
          <div className="rounded-md border border-border bg-background p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">
                  Realized receipts ({receipts.length})
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Dashboard monetary achievement is calculated strictly from recorded
                  receipts.
                </p>
              </div>
              {editable && isWon && (
                <Button
                  type="button"
                  size="compact"
                  onClick={() => setReceiptDialogOpen(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Record receipt
                </Button>
              )}
            </div>

            {!isWon && receipts.length === 0 ? (
              <div className="rounded-sm border border-border bg-surface p-4 text-[13px] text-muted-foreground">
                Receipts can be recorded once this pipeline moves to a{' '}
                <span className="font-medium text-foreground">
                  Contract Signed (Won)
                </span>{' '}
                stage.
              </div>
            ) : receipts.length === 0 ? (
              <EmptyState
                message="No receipts recorded for this Won pipeline yet."
                actionLabel={editable ? 'Record first receipt' : undefined}
                onAction={editable ? () => setReceiptDialogOpen(true) : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-surface text-[12px] font-medium text-muted-foreground">
                      <th className="px-3 py-2">Received on</th>
                      <th className="px-3 py-2 text-right">Original amount</th>
                      <th className="px-3 py-2 text-right">Base amount (BDT)</th>
                      <th className="px-3 py-2">Recorded by</th>
                      <th className="px-3 py-2">Reference / note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {receipts.map((rc) => (
                      <tr key={rc.id} className="hover:bg-surface-2">
                        <td className="px-3 py-2.5">
                          <DateText value={rc.received_on} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money amount={rc.amount} currency={rc.currency} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                          <Money amount={rc.amount_base} currency="BDT" />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {rc.created_by_name ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {rc.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Linked Meetings & Activities */}
          <div className="rounded-md border border-border bg-background">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 pt-3">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('meetings')}
                  className={`border-b-2 pb-2.5 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
                    activeTab === 'meetings'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Meetings ({meetings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activities')}
                  className={`border-b-2 pb-2.5 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
                    activeTab === 'activities'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Activities ({activities.length})
                </button>
              </div>

              <div className="pb-2">
                {activeTab === 'meetings' ? (
                  <Link
                    href={`/meetings?new=1&pipelineId=${pipeline.id}&contactId=${pipeline.contact_id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Schedule meeting</span>
                  </Link>
                ) : (
                  <Link
                    href={`/activities?new=1&pipelineId=${pipeline.id}&contactId=${pipeline.contact_id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Log activity</span>
                  </Link>
                )}
              </div>
            </div>

            <div className="p-4">
              {activeTab === 'meetings' &&
                (meetings.length === 0 ? (
                  <EmptyState
                    message="No meetings linked to this pipeline yet."
                    actionLabel="Schedule meeting"
                    actionHref={`/meetings?new=1&pipelineId=${pipeline.id}&contactId=${pipeline.contact_id}`}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-border bg-surface text-[12px] font-medium text-muted-foreground">
                          <th className="px-3 py-2">Scheduled date</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Owner</th>
                          <th className="px-3 py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {meetings.map((m) => (
                          <tr key={m.id} className="hover:bg-surface-2">
                            <td className="px-3 py-2.5">
                              <DateText value={m.scheduled_at} includeTime />
                            </td>
                            <td className="px-3 py-2.5">
                              <Tag
                                tone={m.status === 'done' ? 'positive' : 'neutral'}
                              >
                                {m.status}
                              </Tag>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {m.owner_name}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {m.description || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

              {activeTab === 'activities' &&
                (activities.length === 0 ? (
                  <EmptyState
                    message="No activities linked to this pipeline yet."
                    actionLabel="Log activity"
                    actionHref={`/activities?new=1&pipelineId=${pipeline.id}&contactId=${pipeline.contact_id}`}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-border bg-surface text-[12px] font-medium text-muted-foreground">
                          <th className="px-3 py-2">Title</th>
                          <th className="px-3 py-2">Type / Class</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Owner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activities.map((a) => (
                          <tr key={a.id} className="hover:bg-surface-2">
                            <td className="px-3 py-2.5 font-medium text-foreground">
                              {a.title}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {a.type} · {a.class}
                            </td>
                            <td className="px-3 py-2.5">
                              <Tag
                                tone={a.status === 'done' ? 'positive' : 'neutral'}
                              >
                                {a.status}
                              </Tag>
                            </td>
                            <td className="px-3 py-2.5">
                              <DateText value={a.occurred_at ?? a.due_at} />
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {a.owner_name}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Record Receipt Dialog */}
      <RecordReceiptDialog
        open={receiptDialogOpen}
        onClose={() => setReceiptDialogOpen(false)}
        pipelineId={pipeline.id}
        dealName={pipeline.deal_name}
        defaultCurrency={pipeline.currency}
        expectedAmountBase={pipeline.amount_base}
        receivedAmountBase={pipeline.received_amount_base}
        currencies={referenceData.currencies}
        fxRates={referenceData.fxRates}
      />

      {/* Edit Pipeline Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pipeline-dialog-title"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditing(false);
            }
          }}
        >
          <div className="w-full max-w-[720px] rounded-md border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2
                id="edit-pipeline-dialog-title"
                className="text-[16px] leading-6 font-semibold text-foreground"
              >
                Edit pipeline: {pipeline.deal_name}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-[13px] text-muted-foreground hover:text-foreground outline-none focus:outline-none focus-visible:outline-none"
              >
                Close
              </button>
            </div>

            <PipelineForm
              mode="edit"
              pipelineId={pipeline.id}
              currentUserId={currentUser.id}
              referenceData={referenceData}
              contactOptions={contactOptions}
              initialValues={{
                deal_name: pipeline.deal_name,
                focal_person_id: pipeline.focal_person_id,
                contribution_type: pipeline.contribution_type,
                category_id: pipeline.category_id,
                party_type: pipeline.party_type,
                contact_id: pipeline.contact_id,
                poc_contact_id: pipeline.poc_contact_id,
                secondary_contact_id: pipeline.secondary_contact_id,
                stage_id: pipeline.stage_id,
                expected_amount: pipeline.expected_amount,
                currency: pipeline.currency,
                payment_interval: pipeline.payment_interval,
                expected_close: pipeline.expected_close,
                country: pipeline.country,
                description: pipeline.description,
                operational_budget: pipeline.operational_budget,
                notes: pipeline.notes,
                in_kind_valuation_note: pipeline.in_kind_valuation_note,
                lost_reason: pipeline.lost_reason,
              }}
              onSuccess={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
