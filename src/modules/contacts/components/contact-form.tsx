'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Combobox,
  Field,
  FormSection,
  Input,
  Select,
  Textarea,
} from '@/shared/ui';
import type { ChannelKind, ContactStatus, ContactType } from '@/types/database';
import {
  createContactAction,
  updateContactAction,
  type SaveContactResult,
} from '../actions';
import type { ContactLiteOption, DuplicateContactMatch } from '../repository';
import type { ContactChannelInput } from '../schema';

export interface ContactFormInitialValues {
  id?: string;
  type: ContactType;
  name: string;
  organization_id?: string | null;
  designation?: string | null;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
  status?: ContactStatus;
  channels: ContactChannelInput[];
}

export interface ContactFormProps {
  mode?: 'create' | 'edit';
  fixedType?: ContactType;
  initialValues?: Partial<ContactFormInitialValues>;
  companyOptions?: ContactLiteOption[];
  compact?: boolean;
  onSuccess: (contact: { id: string; name: string; type: ContactType }) => void;
  onCancel: () => void;
  onSelectDuplicate?: (existing: DuplicateContactMatch) => void;
}

export function ContactForm({
  mode = 'create',
  fixedType,
  initialValues,
  companyOptions: initialCompanies = [],
  compact = false,
  onSuccess,
  onCancel,
  onSelectDuplicate,
}: ContactFormProps) {
  const [type, setType] = React.useState<ContactType>(
    fixedType ?? initialValues?.type ?? 'individual',
  );
  const [name, setName] = React.useState(initialValues?.name ?? '');
  const [organizationId, setOrganizationId] = React.useState<string>(
    initialValues?.organization_id ?? '',
  );
  const [designation, setDesignation] = React.useState(
    initialValues?.designation ?? '',
  );
  const [website, setWebsite] = React.useState(initialValues?.website ?? '');
  const [industry, setIndustry] = React.useState(initialValues?.industry ?? '');
  const [notes, setNotes] = React.useState(initialValues?.notes ?? '');
  const [status, setStatus] = React.useState<ContactStatus>(
    initialValues?.status ?? 'active',
  );
  const [channels, setChannels] = React.useState<ContactChannelInput[]>(
    initialValues?.channels && initialValues.channels.length > 0
      ? initialValues.channels
      : [{ kind: 'email', value: '', is_primary: true }],
  );

  const [companies, setCompanies] = React.useState<ContactLiteOption[]>(initialCompanies);
  const [creatingCompanyInline, setCreatingCompanyInline] = React.useState(false);
  const [inlineCompanyName, setInlineCompanyName] = React.useState('');
  const [inlineCompanyChannelKind, setInlineCompanyChannelKind] =
    React.useState<ChannelKind>('email');
  const [inlineCompanyChannelValue, setInlineCompanyChannelValue] = React.useState('');
  const [inlineCompanyBusy, setInlineCompanyBusy] = React.useState(false);
  const [inlineCompanyError, setInlineCompanyError] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [duplicateMatch, setDuplicateMatch] =
    React.useState<DuplicateContactMatch | null>(null);

  const handleAddChannel = () => {
    setChannels((prev) => [
      ...prev,
      { kind: 'phone', value: '', is_primary: false },
    ]);
  };

  const handleRemoveChannel = (index: number) => {
    setChannels((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (!next.some((c) => c.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  };

  const handleChannelChange = (
    index: number,
    patch: Partial<ContactChannelInput>,
  ) => {
    setChannels((prev) =>
      prev.map((ch, idx) => {
        if (patch.is_primary) {
          return { ...ch, ...(idx === index ? patch : { is_primary: false }) };
        }
        return idx === index ? { ...ch, ...patch } : ch;
      }),
    );
  };

  const handleCreateInlineCompany = async () => {
    setInlineCompanyError(null);
    if (!inlineCompanyName.trim() || !inlineCompanyChannelValue.trim()) {
      setInlineCompanyError('Enter the company name and at least one email or phone.');
      return;
    }

    setInlineCompanyBusy(true);
    try {
      const res = await createContactAction({
        type: 'company',
        name: inlineCompanyName.trim(),
        status: 'active',
        channels: [
          {
            kind: inlineCompanyChannelKind,
            value: inlineCompanyChannelValue.trim(),
            is_primary: true,
          },
        ],
      });

      if (res.status === 'duplicate') {
        setInlineCompanyError(
          `Company channel matches existing contact "${res.existing.name}". Selected it automatically.`,
        );
        if (res.existing.type === 'company') {
          setOrganizationId(res.existing.id);
          setCreatingCompanyInline(false);
        }
        return;
      }

      if (res.status === 'error') {
        setInlineCompanyError(res.message);
        return;
      }

      const created = res.contact;
      setCompanies((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          type: 'company',
          organization_id: null,
          organization_name: null,
          designation: null,
          primary_channel: inlineCompanyChannelValue.trim(),
        },
      ]);
      setOrganizationId(created.id);
      setCreatingCompanyInline(false);
      setInlineCompanyName('');
      setInlineCompanyChannelValue('');
      toast.success('Company created');
    } finally {
      setInlineCompanyBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDuplicateMatch(null);
    setSubmitting(true);

    try {
      const payload = {
        type,
        name,
        organization_id: type === 'individual' && organizationId ? organizationId : null,
        designation: type === 'individual' ? designation : null,
        website: type === 'company' ? website : null,
        industry: type === 'company' ? industry : null,
        notes,
        status,
        channels,
      };

      const res: SaveContactResult =
        mode === 'edit' && initialValues?.id
          ? await updateContactAction(initialValues.id, payload)
          : await createContactAction(payload);

      if (res.status === 'duplicate') {
        setDuplicateMatch(res.existing);
        return;
      }

      if (res.status === 'error') {
        setErrorMessage(res.message);
        return;
      }

      toast.success(mode === 'edit' ? 'Contact updated' : 'Contact saved');
      onSuccess(res.contact);
    } finally {
      setSubmitting(false);
    }
  };

  const comboboxCompanyOptions = React.useMemo(
    () => [
      { value: '', label: 'None (independent individual)' },
      ...companies.map((c) => ({
        value: c.id,
        label: c.name,
        subtitle: c.primary_channel ?? undefined,
      })),
    ],
    [companies],
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {errorMessage && (
        <div
          role="alert"
          className="rounded-sm border border-border border-l-2 border-l-negative bg-background px-3 py-2 text-[13px] leading-5 text-negative"
        >
          {errorMessage}
        </div>
      )}

      {duplicateMatch && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-2 rounded-sm border border-border border-l-2 border-l-warning bg-background px-3 py-2.5 text-[13px] leading-5 sm:flex-row sm:items-center"
        >
          <div>
            <p className="font-medium text-foreground">
              Duplicate {duplicateMatch.matched_kind} found ({duplicateMatch.matched_value})
            </p>
            <p className="text-[12px] text-muted-foreground">
              Already belongs to {duplicateMatch.type} contact:{' '}
              <span className="font-medium text-foreground">{duplicateMatch.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onSelectDuplicate && (
              <Button
                type="button"
                variant="secondary"
                size="compact"
                onClick={() => onSelectDuplicate(duplicateMatch)}
              >
                Use existing
              </Button>
            )}
            <Link
              href={`/contacts/${duplicateMatch.id}`}
              className="inline-flex h-8 items-center rounded-md border border-border-strong px-2.5 text-[13px] font-medium text-primary hover:bg-surface-2"
            >
              Open contact
            </Link>
          </div>
        </div>
      )}

      <FormSection
        title="Identity"
        description="Select whether this contact is an individual or a company."
      >
        {!fixedType && (
          <Field id="contact-type" label="Contact type">
            <Select
              id="contact-type"
              value={type}
              onChange={(e) => setType(e.target.value as ContactType)}
            >
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </Select>
          </Field>
        )}

        <Field
          id="contact-name"
          label={type === 'company' ? 'Company name' : 'Full name'}
          className={fixedType ? 'sm:col-span-2' : undefined}
        >
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={
              type === 'company' ? 'e.g. Meghna Industrial Group' : 'e.g. Tariq Hasan'
            }
          />
        </Field>

        {type === 'individual' ? (
          <>
            <Field id="contact-designation" label="Designation" optional>
              <Input
                id="contact-designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Head of CSR"
              />
            </Field>

            <Field
              id="contact-org"
              label="Organization / workplace"
              optional
              helperText="Leave blank for an independent individual donor."
            >
              <Combobox
                id="contact-org"
                options={comboboxCompanyOptions}
                value={organizationId}
                onChange={(val) => setOrganizationId(val)}
                placeholder="Select company (or leave blank)…"
                searchPlaceholder="Search internal companies…"
                footerActionLabel="+ Create new company"
                onFooterAction={() => setCreatingCompanyInline(true)}
              />
            </Field>

            {creatingCompanyInline && (
              <div className="rounded-md border border-border bg-surface p-3 sm:col-span-2">
                <p className="mb-2 text-[13px] font-semibold text-foreground">
                  Create new company
                </p>
                {inlineCompanyError && (
                  <p className="mb-2 text-[12px] text-negative">{inlineCompanyError}</p>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    value={inlineCompanyName}
                    onChange={(e) => setInlineCompanyName(e.target.value)}
                    placeholder="Company name"
                    className="h-8 text-[13px]"
                  />
                  <Select
                    value={inlineCompanyChannelKind}
                    onChange={(e) =>
                      setInlineCompanyChannelKind(e.target.value as ChannelKind)
                    }
                    className="h-8 text-[13px]"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </Select>
                  <Input
                    value={inlineCompanyChannelValue}
                    onChange={(e) => setInlineCompanyChannelValue(e.target.value)}
                    placeholder={
                      inlineCompanyChannelKind === 'email'
                        ? 'info@company.com'
                        : '01712345678'
                    }
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="compact"
                    onClick={() => setCreatingCompanyInline(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    loading={inlineCompanyBusy}
                    onClick={handleCreateInlineCompany}
                  >
                    Save company
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <Field id="contact-industry" label="Industry" optional>
              <Input
                id="contact-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Banking & Finance"
              />
            </Field>

            <Field id="contact-website" label="Website" optional>
              <Input
                id="contact-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </Field>
          </>
        )}

        <Field id="contact-status" label="Status">
          <Select
            id="contact-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ContactStatus)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title="Contact channels"
        description="At least one email address or phone number is required. Duplicate emails and phones are checked across all PSE contacts."
      >
        <div className="flex flex-col gap-2.5 sm:col-span-2">
          {channels.map((ch, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <div className="w-28 shrink-0">
                <Select
                  aria-label={`Channel ${idx + 1} type`}
                  value={ch.kind}
                  onChange={(e) =>
                    handleChannelChange(idx, {
                      kind: e.target.value as ChannelKind,
                    })
                  }
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </Select>
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  aria-label={`Channel ${idx + 1} value`}
                  value={ch.value}
                  onChange={(e) => handleChannelChange(idx, { value: e.target.value })}
                  required
                  placeholder={
                    ch.kind === 'email' ? 'name@organization.org' : '01712-345678'
                  }
                />
              </div>
              <Button
                type="button"
                variant={ch.is_primary ? 'primary' : 'secondary'}
                size="compact"
                onClick={() => handleChannelChange(idx, { is_primary: true })}
              >
                {ch.is_primary ? 'Primary' : 'Set primary'}
              </Button>
              {channels.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  onClick={() => handleRemoveChannel(idx)}
                  aria-label={`Remove channel ${idx + 1}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}

          <div>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={handleAddChannel}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add channel
            </Button>
          </div>
        </div>
      </FormSection>

      {!compact && (
        <FormSection
          title="Relationship intelligence & notes"
          description="Record referrals, donor background, family/board connections, or paste Google Drive links."
        >
          <Field
            id="contact-notes"
            label="Notes"
            optional
            className="sm:col-span-2"
          >
            <Textarea
              id="contact-notes"
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Background notes, referral source, or Google Drive URLs…"
            />
          </Field>
        </FormSection>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save contact
        </Button>
      </div>
    </form>
  );
}
