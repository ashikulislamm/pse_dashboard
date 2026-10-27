import type { AppRole, ContactType, MeetingStatus } from '@/types/database';
import type { MeetingFormInput } from './schema';

export interface PreparedMeetingPayload {
  contact_id: string | null;
  pipeline_id: string | null;
  scheduled_at: string;
  status: MeetingStatus;
  description: string | null;
  owner_id: string;
}

export interface DerivedMeetingContactSummary {
  effectiveContactId: string | null;
  contactName: string | null;
  contactType: ContactType | null;
  organizationName: string | null;
  designation: string | null;
}

/**
 * Prepares and validates a `MeetingFormInput`:
 * - Enforces that at least one of `contact_id` or `pipeline_id` is provided.
 * - Normalizes `scheduled_at` to a valid ISO timestamp string.
 */
export function prepareMeetingPayload(input: MeetingFormInput): PreparedMeetingPayload {
  const cleanStr = (val?: string | null) => {
    const t = val?.trim();
    return t ? t : null;
  };

  const contactId = cleanStr(input.contact_id);
  const pipelineId = cleanStr(input.pipeline_id);

  if (!contactId && !pipelineId) {
    throw new Error('Meeting must be linked to a contact or a pipeline.');
  }

  const rawDate = input.scheduled_at.trim();
  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Select a valid scheduled date and time.');
  }

  return {
    contact_id: contactId,
    pipeline_id: pipelineId,
    scheduled_at: parsedDate.toISOString(),
    status: input.status ?? 'scheduled',
    description: cleanStr(input.description),
    owner_id: input.owner_id,
  };
}

/**
 * Derives the display contact, organization name, and designation for a meeting.
 * Per PHASES.md P5:
 * - If only a pipeline is chosen, the pipeline's contact is shown.
 * - Organization name and designation are displayed from the linked contact's structured fields, never typed.
 */
export function deriveMeetingContactInfo(params: {
  directContact?: {
    id: string;
    name: string;
    type: ContactType;
    organization_name: string | null;
    designation: string | null;
  } | null;
  pipelineContact?: {
    id: string;
    name: string;
    type: ContactType;
    organization_name: string | null;
    designation: string | null;
  } | null;
}): DerivedMeetingContactSummary {
  const active = params.directContact ?? params.pipelineContact ?? null;
  if (!active) {
    return {
      effectiveContactId: null,
      contactName: null,
      contactType: null,
      organizationName: null,
      designation: null,
    };
  }

  const organizationName =
    active.type === 'company' ? active.name : active.organization_name;

  return {
    effectiveContactId: active.id,
    contactName: active.name,
    contactType: active.type,
    organizationName: organizationName ?? null,
    designation: active.designation ?? null,
  };
}

/**
 * Checks whether an authenticated PSE user can edit or mark a meeting as done.
 * Writes are allowed for the meeting's `owner_id` or `admin`.
 */
export function canEditMeeting(
  actor: { id: string; role: AppRole },
  meeting: { owner_id: string },
): boolean {
  return actor.role === 'admin' || meeting.owner_id === actor.id;
}
