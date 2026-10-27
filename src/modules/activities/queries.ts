'use server';

import { getContactPickerInitialOptions } from '@/modules/contacts';
import { getMeetingsLiteOptions } from '@/modules/meetings';
import { getPipelinesLiteOptions } from '@/modules/pipelines';
import { requireUser } from '@/shared/lib/rbac';
import { listActivities, listActivityOwners } from './repository';
import type { ActivityFilters } from './schema';

export async function getActivitiesPageData(filters: ActivityFilters = {}) {
  const user = await requireUser();
  const [activities, owners, contactOptions, pipelineOptions, meetingOptions] =
    await Promise.all([
      listActivities(user.id, filters),
      listActivityOwners(user.id),
      getContactPickerInitialOptions(),
      getPipelinesLiteOptions(),
      getMeetingsLiteOptions(),
    ]);

  return {
    currentUser: user,
    activities,
    owners,
    contactOptions,
    pipelineOptions,
    meetingOptions,
  };
}
