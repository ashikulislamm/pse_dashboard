import type {
  ActivityClass,
  ActivityStatus,
  ActivityType,
  AppRole,
} from '@/types/database';
import type { ActivityFormInput } from './schema';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  task: 'Task',
  email: 'Email (manual log)',
  call: 'Call',
  meeting: 'Meeting log',
  event: 'Event',
  campaign: 'Campaign',
  proposal: 'Proposal',
  visit: 'Visit',
  servicing: 'Servicing',
  prospect_engagement: 'Prospect engagement',
  general: 'General / Small in-kind',
};

export const ACTIVITY_CLASS_LABELS: Record<ActivityClass, string> = {
  stewardship: 'Stewardship (existing donors)',
  prospect_engagement: 'Prospect engagement (pre-pipeline)',
  independent: 'Independent (visits, events, unvalued)',
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export interface PreparedActivityPayload {
  title: string;
  type: ActivityType;
  class: ActivityClass;
  owner_id: string;
  contact_id: string | null;
  pipeline_id: string | null;
  meeting_id: string | null;
  related_org_name: string | null;
  status: ActivityStatus;
  remaining_work: string | null;
  occurred_at: string | null;
  due_at: string | null;
  notes: string | null;
}

/** Default reporting class: servicing is stewardship, prospect engagement keeps its name, the rest are independent. */
export function defaultActivityClassForType(type: ActivityType): ActivityClass {
  if (type === 'servicing') return 'stewardship';
  if (type === 'prospect_engagement') return 'prospect_engagement';
  return 'independent';
}

function normalizeOptionalTimestamp(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  // Accepts a plain date or a full datetime-local string
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T09:00:00.000Z`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date value: "${raw}".`);
  }
  return d.toISOString();
}

/** Cleans the form input into a DB payload. Links are optional and activities never touch money figures. */
export function prepareActivityPayload(
  input: ActivityFormInput,
): PreparedActivityPayload {
  const cleanStr = (val?: string | null) => {
    const t = val?.trim();
    return t ? t : null;
  };

  const title = input.title.trim();
  if (title.length < 2) {
    throw new Error('Enter the activity title.');
  }

  const activityClass = input.class ?? defaultActivityClassForType(input.type);

  return {
    title,
    type: input.type,
    class: activityClass,
    owner_id: input.owner_id,
    contact_id: cleanStr(input.contact_id),
    pipeline_id: cleanStr(input.pipeline_id),
    meeting_id: cleanStr(input.meeting_id),
    related_org_name: cleanStr(input.related_org_name),
    status: input.status ?? 'planned',
    remaining_work: cleanStr(input.remaining_work),
    occurred_at: normalizeOptionalTimestamp(input.occurred_at),
    due_at: normalizeOptionalTimestamp(input.due_at),
    notes: cleanStr(input.notes),
  };
}

/** Everyone in the team can read; only the owner or an admin can edit. */
export function canEditActivity(
  actor: { id: string; role: AppRole },
  activity: { owner_id: string },
): boolean {
  return actor.role === 'admin' || activity.owner_id === actor.id;
}
