'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ContactPicker, type ContactLiteOption } from '@/modules/contacts';
import type { MeetingLiteOption } from '@/modules/meetings';
import type { PipelineLiteOption } from '@/modules/pipelines';
import {
  Button,
  DatePicker,
  Field,
  FormSection,
  Input,
  Select,
  Textarea,
} from '@/shared/ui';
import type { ActivityClass, ActivityStatus, ActivityType } from '@/types/database';
import { createActivityAction, updateActivityAction } from '../actions';
import type { ActivityOwnerOption } from '../repository';
import type { ActivityFormInput } from '../schema';
import {
  ACTIVITY_CLASS_LABELS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  defaultActivityClassForType,
} from '../service';

export interface ActivityFormProps {
  mode: 'create' | 'edit';
  activityId?: string;
  currentUserId: string;
  owners: ActivityOwnerOption[];
  contactOptions: ContactLiteOption[];
  pipelineOptions: PipelineLiteOption[];
  meetingOptions: MeetingLiteOption[];
  initialValues?: Partial<ActivityFormInput>;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

function toDateInputValue(isoOrDate?: string | null): string {
  if (!isoOrDate) return '';
  return isoOrDate.slice(0, 10);
}

export function ActivityForm({
  mode,
  activityId,
  currentUserId,
  owners,
  contactOptions,
  pipelineOptions,
  meetingOptions,
  initialValues,
  onSuccess,
  onCancel,
}: ActivityFormProps) {
  const initialType: ActivityType = initialValues?.type ?? 'task';
  const [title, setTitle] = React.useState(initialValues?.title ?? '');
  const [type, setType] = React.useState<ActivityType>(initialType);
  const [activityClass, setActivityClass] = React.useState<ActivityClass>(
    initialValues?.class ?? defaultActivityClassForType(initialType),
  );
  const [classManuallyCustomized, setClassManuallyCustomized] = React.useState(
    Boolean(initialValues?.class),
  );
  const [ownerId, setOwnerId] = React.useState(
    initialValues?.owner_id ?? currentUserId,
  );
  const [contactId, setContactId] = React.useState(initialValues?.contact_id ?? '');
  const [pipelineId, setPipelineId] = React.useState(initialValues?.pipeline_id ?? '');
  const [meetingId, setMeetingId] = React.useState(initialValues?.meeting_id ?? '');
  const [relatedOrgName, setRelatedOrgName] = React.useState(
    initialValues?.related_org_name ?? '',
  );
  const [status, setStatus] = React.useState<ActivityStatus>(
    initialValues?.status ?? 'planned',
  );
  const [remainingWork, setRemainingWork] = React.useState(
    initialValues?.remaining_work ?? '',
  );
  const [occurredAt, setOccurredAt] = React.useState(() =>
    initialValues?.occurred_at !== undefined
      ? toDateInputValue(initialValues.occurred_at)
      : new Date().toISOString().slice(0, 10),
  );
  const [dueAt, setDueAt] = React.useState(() =>
    toDateInputValue(initialValues?.due_at),
  );
  const [notes, setNotes] = React.useState(initialValues?.notes ?? '');

  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const companyOptions = React.useMemo(
    () => contactOptions.filter((c) => c.type === 'company'),
    [contactOptions],
  );

  const handleTypeChange = (nextType: ActivityType) => {
    setType(nextType);
    if (!classManuallyCustomized) {
      setActivityClass(defaultActivityClassForType(nextType));
    }
  };

  const handleMeetingSelect = (nextMeetingId: string) => {
    setMeetingId(nextMeetingId);
    if (!nextMeetingId) return;
    const found = meetingOptions.find((m) => m.id === nextMeetingId);
    if (!found) return;
    if (!contactId && found.contact_id) {
      setContactId(found.contact_id);
    }
    if (!pipelineId && found.pipeline_id) {
      setPipelineId(found.pipeline_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: ActivityFormInput = {
      title,
      type,
      class: activityClass,
      owner_id: ownerId,
      contact_id: contactId || null,
      pipeline_id: pipelineId || null,
      meeting_id: meetingId || null,
      related_org_name: relatedOrgName.trim() || null,
      status,
      remaining_work: remainingWork.trim() || null,
      occurred_at: occurredAt || null,
      due_at: dueAt || null,
      notes: notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const res =
        mode === 'create'
          ? await createActivityAction(payload)
          : await updateActivityAction(activityId!, payload);

      if (res.status === 'error') {
        setError(res.message);
        return;
      }

      toast.success(mode === 'create' ? 'Activity logged.' : 'Activity updated.');
      onSuccess?.(res.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-md border border-border bg-surface p-3 text-[13px] leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">Non-monetary tracker:</span>{' '}
        Activities record stewardship, prospect engagement, independent outreach, follow-up
        tasks, and small unvalued items. They never alter monetary pipeline or receipt
        figures.
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-negative bg-negative-subtle p-3 text-[13px] text-negative"
        >
          {error}
        </div>
      )}

      <FormSection
        title="Activity classification & title"
        description="Select one of the 11 activity types and its non-monetary reporting class."
      >
        <div className="sm:col-span-2">
          <Field id="activity-title" label="Activity title" requiredLabel>
            <Input
              id="activity-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Send revised CSR partnership concept note to Apex Footwear"
              required
              autoFocus
            />
          </Field>
        </div>

        <Field id="activity-type" label="Activity type (11 types)" requiredLabel>
          <Select
            id="activity-type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as ActivityType)}
          >
            {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="activity-class"
          label="Non-monetary reporting class"
          requiredLabel
          helperText="Auto-selected from type (Servicing → Stewardship, Prospect engagement → Prospect, others → Independent), but editable."
        >
          <Select
            id="activity-class"
            value={activityClass}
            onChange={(e) => {
              setActivityClass(e.target.value as ActivityClass);
              setClassManuallyCustomized(true);
            }}
          >
            {(Object.keys(ACTIVITY_CLASS_LABELS) as ActivityClass[]).map((c) => (
              <option key={c} value={c}>
                {ACTIVITY_CLASS_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="activity-owner" label="Owner" requiredLabel>
          <Select
            id="activity-owner"
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

        <Field id="activity-status" label="Status" requiredLabel>
          <Select
            id="activity-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ActivityStatus)}
          >
            {(Object.keys(ACTIVITY_STATUS_LABELS) as ActivityStatus[]).map((st) => (
              <option key={st} value={st}>
                {ACTIVITY_STATUS_LABELS[st]}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title="Related records (all optional)"
        description="Link to a contact, pipeline, or meeting follow-up — or enter a free-text organization name for independent outreach."
      >
        <Field
          id="activity-contact"
          label="Linked contact"
          optional
          helperText="Search internal contacts or create one inline."
        >
          <ContactPicker
            id="activity-contact"
            options={contactOptions}
            companyOptions={companyOptions}
            allowClear
            value={contactId}
            onChange={(id) => setContactId(id)}
            placeholder="Select contact (optional)…"
          />
        </Field>

        <Field id="activity-pipeline" label="Linked pipeline" optional>
          <Select
            id="activity-pipeline"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
          >
            <option value="">None</option>
            {pipelineOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.deal_name} ({p.contact_name})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="activity-meeting"
          label="Follow-up to meeting"
          optional
          helperText="Selecting a meeting automatically links its contact and pipeline."
        >
          <Select
            id="activity-meeting"
            value={meetingId}
            onChange={(e) => handleMeetingSelect(e.target.value)}
          >
            <option value="">None</option>
            {meetingOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.scheduled_at.slice(0, 10)} —{' '}
                {m.contact_name ?? m.pipeline_deal_name ?? 'Meeting'}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="activity-related-org"
          label="Related organization name (when no contact linked)"
          optional
        >
          <Input
            id="activity-related-org"
            value={relatedOrgName}
            onChange={(e) => setRelatedOrgName(e.target.value)}
            placeholder="e.g., Dhaka Chamber of Commerce & Industry"
          />
        </Field>
      </FormSection>

      <FormSection
        title="Dates, remaining work & notes"
        description="Track occurred date, due date, remaining follow-up work, and notes."
      >
        <Field id="activity-occurred-at" label="Occurred on" optional>
          <DatePicker
            id="activity-occurred-at"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>

        <Field id="activity-due-at" label="Due on" optional>
          <DatePicker
            id="activity-due-at"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            id="activity-remaining-work"
            label="Remaining work / next step"
            optional
          >
            <Input
              id="activity-remaining-work"
              value={remainingWork}
              onChange={(e) => setRemainingWork(e.target.value)}
              placeholder="e.g., Share signed donor receipt and invite to Q2 site visit"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            id="activity-notes"
            label="Notes & Google Drive links"
            optional
            helperText="Google Drive links pasted here render as clickable links."
          >
            <Textarea
              id="activity-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detailed context, small in-kind item description, or reference URLs…"
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
              ? 'Log activity'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
