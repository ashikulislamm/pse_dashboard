'use server';

import { revalidatePath } from 'next/cache';
import { CACHE_TAGS, invalidateTags } from '@/shared/lib/cache';
import { requireUser } from '@/shared/lib/rbac';
import type { MeetingStatus } from '@/types/database';
import {
  createMeetingRecord,
  updateMeetingRecord,
  updateMeetingStatusRecord,
} from './repository';
import { meetingFormSchema, meetingStatusSchema, type MeetingFormInput } from './schema';
import { prepareMeetingPayload } from './service';

export type MeetingActionResult =
  | { status: 'success'; id: string }
  | { status: 'error'; message: string };

export async function createMeetingAction(
  rawInput: MeetingFormInput,
): Promise<MeetingActionResult> {
  try {
    const user = await requireUser();
    const parsed = meetingFormSchema.safeParse(rawInput);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        status: 'error',
        message: firstIssue?.message ?? 'Check the meeting fields and try again.',
      };
    }

    const payload = prepareMeetingPayload(parsed.data);
    const created = await createMeetingRecord(user.id, payload);

    invalidateTags(
      CACHE_TAGS.meetings,
      CACHE_TAGS.dashboard,
      CACHE_TAGS.contacts,
      CACHE_TAGS.pipelines,
    );
    revalidatePath('/meetings');
    if (payload.contact_id) revalidatePath(`/contacts/${payload.contact_id}`);
    if (payload.pipeline_id) revalidatePath(`/pipelines/${payload.pipeline_id}`);
    revalidatePath('/dashboard');

    return { status: 'success', id: created.id };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to create meeting.',
    };
  }
}

export async function updateMeetingAction(
  meetingId: string,
  rawInput: MeetingFormInput,
): Promise<MeetingActionResult> {
  try {
    const user = await requireUser();
    const parsed = meetingFormSchema.safeParse(rawInput);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        status: 'error',
        message: firstIssue?.message ?? 'Check the meeting fields and try again.',
      };
    }

    const payload = prepareMeetingPayload(parsed.data);
    const updated = await updateMeetingRecord(user.id, meetingId, payload);

    invalidateTags(
      CACHE_TAGS.meetings,
      CACHE_TAGS.dashboard,
      CACHE_TAGS.contacts,
      CACHE_TAGS.pipelines,
    );
    revalidatePath('/meetings');
    if (payload.contact_id) revalidatePath(`/contacts/${payload.contact_id}`);
    if (payload.pipeline_id) revalidatePath(`/pipelines/${payload.pipeline_id}`);
    revalidatePath('/dashboard');

    return { status: 'success', id: updated.id };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to update meeting.',
    };
  }
}

export async function updateMeetingStatusAction(
  meetingId: string,
  status: MeetingStatus,
): Promise<MeetingActionResult> {
  try {
    const user = await requireUser();
    const parsed = meetingStatusSchema.safeParse(status);
    if (!parsed.success) {
      return { status: 'error', message: 'Invalid meeting status.' };
    }

    const updated = await updateMeetingStatusRecord(user.id, meetingId, parsed.data);

    invalidateTags(CACHE_TAGS.meetings, CACHE_TAGS.dashboard);
    revalidatePath('/meetings');
    revalidatePath('/dashboard');

    return { status: 'success', id: updated.id };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to update meeting status.',
    };
  }
}
