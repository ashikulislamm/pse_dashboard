'use server';

import { revalidatePath } from 'next/cache';
import { CACHE_TAGS, invalidateTags } from '@/shared/lib/cache';
import { requireUser } from '@/shared/lib/rbac';
import type { ActivityStatus } from '@/types/database';
import {
  createActivityRecord,
  updateActivityRecord,
  updateActivityStatusRecord,
} from './repository';
import {
  activityFormSchema,
  activityStatusSchema,
  type ActivityFormInput,
} from './schema';
import { prepareActivityPayload } from './service';

export type ActivityActionResult =
  | { status: 'success'; id: string }
  | { status: 'error'; message: string };

export async function createActivityAction(
  rawInput: ActivityFormInput,
): Promise<ActivityActionResult> {
  try {
    const user = await requireUser();
    const parsed = activityFormSchema.safeParse(rawInput);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        status: 'error',
        message: firstIssue?.message ?? 'Check the activity fields and try again.',
      };
    }

    const payload = prepareActivityPayload(parsed.data);
    const created = await createActivityRecord(user.id, payload);

    invalidateTags(
      CACHE_TAGS.activities,
      CACHE_TAGS.dashboard,
      CACHE_TAGS.contacts,
      CACHE_TAGS.pipelines,
      CACHE_TAGS.meetings,
    );
    revalidatePath('/activities');
    revalidatePath('/meetings');
    if (payload.contact_id) revalidatePath(`/contacts/${payload.contact_id}`);
    if (payload.pipeline_id) revalidatePath(`/pipelines/${payload.pipeline_id}`);
    revalidatePath('/dashboard');

    return { status: 'success', id: created.id };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to create activity.',
    };
  }
}

export async function updateActivityAction(
  activityId: string,
  rawInput: ActivityFormInput,
): Promise<ActivityActionResult> {
  try {
    const user = await requireUser();
    const parsed = activityFormSchema.safeParse(rawInput);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        status: 'error',
        message: firstIssue?.message ?? 'Check the activity fields and try again.',
      };
    }

    const payload = prepareActivityPayload(parsed.data);
    const updated = await updateActivityRecord(user.id, activityId, payload);

    invalidateTags(
      CACHE_TAGS.activities,
      CACHE_TAGS.dashboard,
      CACHE_TAGS.contacts,
      CACHE_TAGS.pipelines,
      CACHE_TAGS.meetings,
    );
    revalidatePath('/activities');
    revalidatePath('/meetings');
    if (payload.contact_id) revalidatePath(`/contacts/${payload.contact_id}`);
    if (payload.pipeline_id) revalidatePath(`/pipelines/${payload.pipeline_id}`);
    revalidatePath('/dashboard');

    return { status: 'success', id: updated.id };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to update activity.',
    };
  }
}

export async function updateActivityStatusAction(
  activityId: string,
  status: ActivityStatus,
): Promise<ActivityActionResult> {
  try {
    const user = await requireUser();
    const parsed = activityStatusSchema.safeParse(status);
    if (!parsed.success) {
      return { status: 'error', message: 'Invalid activity status.' };
    }

    const updated = await updateActivityStatusRecord(user.id, activityId, parsed.data);

    invalidateTags(CACHE_TAGS.activities, CACHE_TAGS.dashboard);
    revalidatePath('/activities');
    revalidatePath('/dashboard');

    return { status: 'success', id: updated.id };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to update activity status.',
    };
  }
}
