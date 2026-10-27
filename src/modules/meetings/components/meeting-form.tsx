'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ContactPicker, type ContactLiteOption } from '@/modules/contacts';
import type { PipelineLiteOption } from '@/modules/pipelines';
import {
  Button,
  DatePicker,
  Field,
  FormSection,
  Select,
  Tag,
  Textarea,
} from '@/shared/ui';
import type { MeetingStatus } from '@/types/database';
import { createMeetingAction, updateMeetingAction } from '../actions';
import type { MeetingOwnerOption } from '../repository';
import type { MeetingFormInput } from '../schema';
import { deriveMeetingContactInfo } from '../service';

export interface MeetingFormProps {
  mode: 'create' | 'edit';
  meetingId?: string;
  currentUserId: string;
  owners: MeetingOwnerOption[];
  contactOptions: ContactLiteOption[];
  pipelineOptions: PipelineLiteOption[];
  initialValues?: Partial<MeetingFormInput>;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

function toDatetimeLocalValue(isoOrLocal?: string | null): string {
  if (!isoOrLocal) {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  }
  const d = new Date(isoOrLocal);
  if (Number.isNaN(d.getTime())) return isoOrLocal.slice(0, 16);
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function MeetingForm({
  mode,
  meetingId,
  currentUserId,
  owners,
  contactOptions,
  pipelineOptions,
  initialValues,
  onSuccess,
  onCancel,
}: MeetingFormProps) {
  const [contactId, setContactId] = React.useState(initialValues?.contact_id ?? '');
  const [pipelineId, setPipelineId] = React.useState(initialValues?.pipeline_id ?? '');
  const [scheduledAt, setScheduledAt] = React.useState(() =>
    toDatetimeLocalValue(initialValues?.scheduled_at),
  );
  const [status, setStatus] = React.useState<MeetingStatus>(
    initialValues?.status ?? 'scheduled',
  );
  const [ownerId, setOwnerId] = React.useState(
    initialValues?.owner_id ?? currentUserId,
  );
  const [description, setDescription] = React.useState(
    initialValues?.description ?? '',
  );
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const companyOptions = React.useMemo(
    () => contactOptions.filter((c) => c.type === 'company'),
    [contactOptions],
  );

  const selectedDirectContact = React.useMemo(
    () => (contactId ? contactOptions.find((c) => c.id === contactId) ?? null : null),
    [contactId, contactOptions],
  );

  const selectedPipeline = React.useMemo(
    () => (pipelineId ? pipelineOptions.find((p) => p.id === pipelineId) ?? null : null),
    [pipelineId, pipelineOptions],
  );

  const selectedPipelineContact = React.useMemo(() => {
    if (!selectedPipeline) return null;
    return (
      contactOptions.find((c) => c.id === selectedPipeline.contact_id) ?? {
        id: selectedPipeline.contact_id,
        name: selectedPipeline.contact_name,
        type: 'company' as const,
        organization_id: null,
        organization_name: selectedPipeline.contact_name,
        designation: null,
        primary_channel: null,
      }
    );
  }, [selectedPipeline, contactOptions]);

  const derivedInfo = React.useMemo(
    () =>
      deriveMeetingContactInfo({
        directContact: selectedDirectContact,
        pipelineContact: selectedPipelineContact,
      }),
    [selectedDirectContact, selectedPipelineContact],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!contactId && !pipelineId) {
      setError('Link the meeting to at least a contact or a pipeline.');
      return;
    }

    const payload: MeetingFormInput = {
      contact_id: contactId || null,
      pipeline_id: pipelineId || null,
      scheduled_at: scheduledAt,
      status,
      owner_id: ownerId,
      description: description.trim() || null,
    };

    setSubmitting(true);
    try {
      const res =
        mode === 'create'
          ? await createMeetingAction(payload)
          : await updateMeetingAction(meetingId!, payload);

      if (res.status === 'error') {
        setError(res.message);
        return;
      }

      toast.success(mode === 'create' ? 'Meeting scheduled.' : 'Meeting updated.');
      onSuccess?.(res.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-negative bg-negative-subtle p-3 text-[13px] text-negative"
        >
          {error}
        </div>
      )}

      <FormSection
        title="Linked contact or pipeline"
        description="Link at least one contact or pipeline. Organization and designation are derived automatically from the contact record."
      >
        <Field
          id="meeting-contact"
          label="Contact"
          optional={Boolean(pipelineId)}
          requiredLabel={!pipelineId}
          helperText="Search internal contacts or create a new contact inline."
        >
          <ContactPicker
            id="meeting-contact"
            options={contactOptions}
            companyOptions={companyOptions}
            allowClear
            value={contactId}
            onChange={(id) => setContactId(id)}
            placeholder="Select contact…"
          />
        </Field>

        <Field
          id="meeting-pipeline"
          label="Pipeline opportunity"
          optional={Boolean(contactId)}
          requiredLabel={!contactId}
          helperText="If only a pipeline is selected, its primary contact is used automatically."
        >
          <Select
            id="meeting-pipeline"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
          >
            <option value="">None (no pipeline linked)</option>
            {pipelineOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.deal_name} ({p.contact_name})
              </option>
            ))}
          </Select>
        </Field>

        <div className="rounded-sm border border-border bg-surface p-3 text-[13px] sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted-foreground">
              Derived contact details (read-only from Contact record)
            </span>
            {!contactId && pipelineId && derivedInfo.contactName && (
              <Tag>Derived from pipeline</Tag>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <div className="text-[11px] text-muted-foreground">Contact</div>
              <div className="font-medium text-foreground">
                {derivedInfo.contactName ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Organization</div>
              <div className="font-medium text-foreground">
                {derivedInfo.organizationName ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Designation</div>
              <div className="font-medium text-foreground">
                {derivedInfo.designation ?? '—'}
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Schedule, status & agenda"
        description="Date-time, meeting status, owner, and discussion notes."
      >
        <Field id="meeting-scheduled-at" label="Scheduled date & time" requiredLabel>
          <DatePicker
            id="meeting-scheduled-at"
            includeTime
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </Field>

        <Field id="meeting-status" label="Status" requiredLabel>
          <Select
            id="meeting-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MeetingStatus)}
          >
            <option value="scheduled">Scheduled</option>
            <option value="done">Done</option>
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field id="meeting-owner" label="Meeting owner" requiredLabel>
            <Select
              id="meeting-owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              {owners.map((ow) => (
                <option key={ow.id} value={ow.id}>
                  {ow.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            id="meeting-description"
            label="Agenda & outcome notes"
            optional
            helperText="Google Drive links pasted here render as clickable links."
          >
            <Textarea
              id="meeting-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize the agenda, attendees, or meeting outcome…"
            />
          </Field>
        </div>
      </FormSection>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting
            ? 'Saving…'
            : mode === 'create'
              ? 'Save meeting'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
