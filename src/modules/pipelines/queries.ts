'use server';

import { getContactPickerInitialOptions } from '@/modules/contacts';
import { requireUser } from '@/shared/lib/rbac';
import {
  getPipelineDetail,
  listPipelineReferenceData,
  listPipelines,
  listPipelinesLite,
} from './repository';
import type { PipelineFilters } from './schema';

export async function getPipelinesPageData(filters: PipelineFilters = {}) {
  const user = await requireUser();
  const [pipelines, referenceData, contactOptions] = await Promise.all([
    listPipelines(user.id, filters),
    listPipelineReferenceData(user.id),
    getContactPickerInitialOptions(),
  ]);

  return {
    currentUser: user,
    pipelines,
    referenceData,
    contactOptions,
  };
}

export async function getPipelineDetailPageData(pipelineId: string) {
  const user = await requireUser();
  const [detail, referenceData, contactOptions] = await Promise.all([
    getPipelineDetail(user.id, pipelineId),
    listPipelineReferenceData(user.id),
    getContactPickerInitialOptions(),
  ]);

  return {
    currentUser: user,
    detail,
    referenceData,
    contactOptions,
  };
}

export async function getPipelinesLiteOptions() {
  const user = await requireUser();
  return listPipelinesLite(user.id);
}
