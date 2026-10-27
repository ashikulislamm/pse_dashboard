'use server';

import { getContactPickerInitialOptions } from '@/modules/contacts';
import { CACHE_TAGS, cached } from '@/shared/lib/cache';
import { requireUser } from '@/shared/lib/rbac';
import {
  fetchPipelineReferenceData,
  getPipelineDetail,
  listPipelines,
  listPipelinesLite,
} from './repository';
import type { PipelineFilters } from './schema';

const loadPipelineReferenceData = cached(
  async () => fetchPipelineReferenceData(),
  ['pipelines-reference-data'],
  [CACHE_TAGS.config],
);

export async function getPipelineReferenceData() {
  await requireUser();
  return loadPipelineReferenceData();
}

export async function getPipelinesPageData(filters: PipelineFilters = {}) {
  const user = await requireUser();
  const [pipelines, referenceData, contactOptions] = await Promise.all([
    listPipelines(user.id, filters),
    loadPipelineReferenceData(),
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
    loadPipelineReferenceData(),
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
