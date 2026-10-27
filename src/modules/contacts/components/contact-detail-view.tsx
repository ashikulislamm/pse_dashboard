'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  AutoLinkedNotes,
  Button,
  Card,
  DateText,
  Money,
  PageHeader,
  Tag,
} from '@/shared/ui';
import type { ContactDetailData, ContactLiteOption } from '../repository';
import { ContactForm } from './contact-form';

export interface ContactDetailViewProps {
  contact: ContactDetailData;
  canEdit: boolean;
  companyOptions: ContactLiteOption[];
}

type RelatedTab = 'pipelines' | 'meetings' | 'activities' | 'individuals';

export function ContactDetailView({
  contact,
  canEdit,
  companyOptions,
}: ContactDetailViewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<RelatedTab>('pipelines');

  React.useEffect(() => {
    if (!editOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editOpen]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/contacts"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Contacts</span>
        </Link>

        <PageHeader
          title={contact.name}
          description={
            contact.type === 'individual'
              ? [contact.designation, contact.organization_name]
                  .filter(Boolean)
                  .join(' · ') || 'Individual contact'
              : [contact.industry, contact.website].filter(Boolean).join(' · ') ||
                'Company contact'
          }
          actions={
            canEdit ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit contact
              </Button>
            ) : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <Card title="Profile details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] leading-5">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="mt-0.5">
                  <Tag>{contact.type}</Tag>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-0.5">
                  <Tag>{contact.status}</Tag>
                </dd>
              </div>

              {contact.type === 'individual' ? (
                <>
                  <div>
                    <dt className="text-muted-foreground">Designation</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {contact.designation ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Organization</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {contact.organization_id && contact.organization_name ? (
                        <Link
                          href={`/contacts/${contact.organization_id}`}
                          className="text-primary hover:underline"
                        >
                          {contact.organization_name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt className="text-muted-foreground">Industry</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {contact.industry ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Website</dt>
                    <dd className="mt-0.5 truncate font-medium text-foreground">
                      {contact.website ? (
                        <a
                          href={contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {contact.website}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </>
              )}

              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="mt-0.5 text-foreground">{contact.owner_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-0.5 text-foreground">
                  <DateText value={contact.created_at} />
                </dd>
              </div>
            </dl>
          </Card>

          <Card
            title="Contact channels"
            description="Normalized emails and E.164 phone numbers."
          >
            <ul className="divide-y divide-border text-[13px] leading-5">
              {contact.channels.map((ch) => (
                <li
                  key={ch.id}
                  className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <Tag>{ch.kind}</Tag>
                    <span className="font-medium text-foreground tabular-nums">
                      {ch.value}
                    </span>
                  </div>
                  {ch.is_primary && (
                    <span className="text-[12px] text-muted-foreground">Primary</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Relationship intelligence & notes"
            description="Referrals, donor context, and Google Drive links."
          >
            <AutoLinkedNotes text={contact.notes} />
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card title="Related records">
            <div className="mb-4 flex items-center gap-4 border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab('pipelines')}
                className={cn(
                  '-mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors duration-100',
                  activeTab === 'pipelines'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Pipelines ({contact.pipelines.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('meetings')}
                className={cn(
                  '-mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors duration-100',
                  activeTab === 'meetings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Meetings ({contact.meetings.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('activities')}
                className={cn(
                  '-mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors duration-100',
                  activeTab === 'activities'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Activities ({contact.activities.length})
              </button>
              {contact.type === 'company' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('individuals')}
                  className={cn(
                    '-mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors duration-100',
                    activeTab === 'individuals'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  People ({contact.affiliatedIndividuals.length})
                </button>
              )}
            </div>

            {activeTab === 'pipelines' && (
              <div>
                {contact.pipelines.length === 0 ? (
                  <p className="py-4 text-[13px] text-muted-foreground">
                    No pipelines linked to this contact yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[13px] leading-5">
                      <thead className="bg-surface text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 font-medium">Deal</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium">Stage</th>
                          <th className="px-3 py-2 text-right font-medium">Expected</th>
                          <th className="px-3 py-2 font-medium">Close date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contact.pipelines.map((p) => (
                          <tr
                            key={p.id}
                            className="h-10 border-b border-border last:border-b-0 hover:bg-surface-2"
                          >
                            <td className="px-3 font-medium text-primary">
                              <Link href={`/pipelines/${p.id}`} className="hover:underline">
                                {p.deal_name}
                              </Link>
                            </td>
                            <td className="px-3 text-muted-foreground">{p.role_in_deal}</td>
                            <td className="px-3">
                              <Tag
                                tone={
                                  p.stage_kind === 'won'
                                    ? 'positive'
                                    : p.stage_kind === 'lost'
                                      ? 'negative'
                                      : 'neutral'
                                }
                              >
                                {p.stage_name}
                              </Tag>
                            </td>
                            <td className="px-3 text-right">
                              <Money
                                amount={p.expected_amount}
                                currency={p.currency}
                                baseAmount={p.amount_base}
                              />
                            </td>
                            <td className="px-3 text-muted-foreground">
                              <DateText value={p.expected_close} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'meetings' && (
              <div>
                {contact.meetings.length === 0 ? (
                  <p className="py-4 text-[13px] text-muted-foreground">
                    No meetings recorded for this contact yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[13px] leading-5">
                      <thead className="bg-surface text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 font-medium">Scheduled</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Description</th>
                          <th className="px-3 py-2 font-medium">Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contact.meetings.map((m) => (
                          <tr
                            key={m.id}
                            className="h-10 border-b border-border last:border-b-0 hover:bg-surface-2"
                          >
                            <td className="px-3">
                              <DateText value={m.scheduled_at} includeTime />
                            </td>
                            <td className="px-3">
                              <Tag tone={m.status === 'done' ? 'positive' : 'neutral'}>
                                {m.status}
                              </Tag>
                            </td>
                            <td className="px-3 text-foreground">
                              {m.description ?? '—'}
                            </td>
                            <td className="px-3 text-muted-foreground">{m.owner_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activities' && (
              <div>
                {contact.activities.length === 0 ? (
                  <p className="py-4 text-[13px] text-muted-foreground">
                    No activities recorded for this contact yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[13px] leading-5">
                      <thead className="bg-surface text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Title</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contact.activities.map((a) => (
                          <tr
                            key={a.id}
                            className="h-10 border-b border-border last:border-b-0 hover:bg-surface-2"
                          >
                            <td className="px-3">
                              <DateText value={a.occurred_at ?? a.due_at} />
                            </td>
                            <td className="px-3">
                              <Tag>{a.type}</Tag>
                            </td>
                            <td className="px-3 font-medium text-foreground">{a.title}</td>
                            <td className="px-3">
                              <Tag tone={a.status === 'done' ? 'positive' : 'neutral'}>
                                {a.status}
                              </Tag>
                            </td>
                            <td className="px-3 text-muted-foreground">{a.owner_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'individuals' && contact.type === 'company' && (
              <div>
                {contact.affiliatedIndividuals.length === 0 ? (
                  <p className="py-4 text-[13px] text-muted-foreground">
                    No individual contacts linked to this company yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[13px] leading-5">
                      <thead className="bg-surface text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Designation</th>
                          <th className="px-3 py-2 font-medium">Primary channel</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contact.affiliatedIndividuals.map((ind) => (
                          <tr
                            key={ind.id}
                            className="h-10 border-b border-border last:border-b-0 hover:bg-surface-2"
                          >
                            <td className="px-3 font-medium text-primary">
                              <Link href={`/contacts/${ind.id}`} className="hover:underline">
                                {ind.name}
                              </Link>
                            </td>
                            <td className="px-3 text-muted-foreground">
                              {ind.designation ?? '—'}
                            </td>
                            <td className="px-3 tabular-nums">
                              {ind.primary_channel ?? '—'}
                            </td>
                            <td className="px-3">
                              <Tag>{ind.status}</Tag>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-contact-sheet-title"
          className="fixed inset-0 z-50 flex justify-end bg-foreground/25"
        >
          <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <h2
                id="edit-contact-sheet-title"
                className="text-[18px] leading-7 font-semibold text-foreground"
              >
                Edit contact
              </h2>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <ContactForm
              mode="edit"
              initialValues={{
                id: contact.id,
                type: contact.type,
                name: contact.name,
                organization_id: contact.organization_id,
                designation: contact.designation,
                website: contact.website,
                industry: contact.industry,
                notes: contact.notes,
                status: contact.status,
                channels: contact.channels.map((ch) => ({
                  kind: ch.kind,
                  value: ch.value,
                  is_primary: ch.is_primary,
                })),
              }}
              companyOptions={companyOptions.filter((c) => c.id !== contact.id)}
              onSuccess={() => {
                setEditOpen(false);
                router.refresh();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
