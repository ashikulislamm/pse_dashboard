'use server';

import { getContactPickerInitialOptions } from '@/modules/contacts';
import { getPipelinesLiteOptions } from '@/modules/pipelines';
import { requireUser } from '@/shared/lib/rbac';
import { listMeetingOwners, listMeetings, listMeetingsLite } from './repository';
import type { MeetingFilters } from './schema';

export async function getMeetingsPageData(filters: MeetingFilters = {}) {
  const user = await requireUser();
  const [meetings, owners, contactOptions, pipelineOptions] = await Promise.all([
    listMeetings(user.id, filters),
    listMeetingOwners(user.id),
    getContactPickerInitialOptions(),
    getPipelinesLiteOptions(),
  ]);

  return {
    currentUser: user,
    meetings,
    owners,
    contactOptions,
    pipelineOptions,
  };
}

export async function getMeetingsLiteOptions() {
  const user = await requireUser();
  return listMeetingsLite(user.id);
}
