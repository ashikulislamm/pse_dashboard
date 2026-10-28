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

/** Cleans meeting input. Needs a contact or a pipeline; scheduled_at becomes an ISO string. */
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

/** Contact, organization and designation to show for a meeting. Falls back to the pipeline's contact. */
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

/** Only the owner or an admin can edit a meeting or mark it done. */
export function canEditMeeting(
  actor: { id: string; role: AppRole },
  meeting: { owner_id: string },
): boolean {
  return actor.role === 'admin' || meeting.owner_id === actor.id;
}
