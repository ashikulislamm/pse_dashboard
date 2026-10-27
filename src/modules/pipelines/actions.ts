'use server';

import { revalidatePath } from 'next/cache';
import { CACHE_TAGS, invalidateTags } from '@/shared/lib/cache';
import { requireUser } from '@/shared/lib/rbac';
import {
  addPipelineReceiptRecord,
  changePipelineStageRecord,
  createPipelineRecord,
  listPipelineReferenceData,
  updatePipelineRecord,
} from './repository';
import {
  changeStageInputSchema,
  pipelineFormSchema,
  recordReceiptInputSchema,
  type ChangeStageInput,
  type PipelineFormInput,
  type RecordReceiptInput,
} from './schema';
import { preparePipelinePayload } from './service';

export type PipelineActionResult =
  | {
      status: 'success';
      id: string;
    }
  | {
      status: 'error';
      message: string;
    };

export async function createPipelineAction(
  rawInput: PipelineFormInput,
): Promise<PipelineActionResult> {
  try {
    const user = await requireUser();
    const parsed = pipelineFormSchema.safeParse(rawInput);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        status: 'error',
        message: firstIssue?.message ?? 'Check the pipeline fields and try again.',
      };
    }

    const refData = await listPipelineReferenceData(user.id);
    const payload = preparePipelinePayload(parsed.data, refData.fxRates, refData.stages);

    const created = await createPipelineRecord(user.id, payload);

    invalidateTags(CACHE_TAGS.pipelines, CACHE_TAGS.dashboard, CACHE_TAGS.contacts);
    revalidatePath('/pipelines');
    revalidatePath(`/contacts/${payload.contact_id}`);
    if (payload.poc_contact_id) {
      revalidatePath(`/contacts/${payload.poc_contact_id}`);
    }
    revalidatePath('/dashboard');

    return {
      status: 'success',
      id: created.id,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to create pipeline.',
    };
  }
}

export async function updatePipelineAction(
  pipelineId: string,
  rawInput: PipelineFormInput,
): Promise<PipelineActionResult> {
  try {
    const user = await requireUser();
    const parsed = pipelineFormSchema.safeParse(rawInput);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        status: 'error',
        message: firstIssue?.message ?? 'Check the pipeline fields and try again.',
      };
    }

    const refData = await listPipelineReferenceData(user.id);
    const payload = preparePipelinePayload(parsed.data, refData.fxRates, refData.stages);

    const updated = await updatePipelineRecord(user.id, pipelineId, payload);

    invalidateTags(
      CACHE_TAGS.pipelines,
      CACHE_TAGS.receipts,
      CACHE_TAGS.dashboard,
      CACHE_TAGS.contacts,
    );
    revalidatePath('/pipelines');
    revalidatePath(`/pipelines/${pipelineId}`);
    revalidatePath(`/contacts/${payload.contact_id}`);
    revalidatePath('/dashboard');

    return {
      status: 'success',
      id: updated.id,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to update pipeline.',
    };
  }
}

export async function changePipelineStageAction(
  rawInput: ChangeStageInput,
): Promise<PipelineActionResult> {
  try {
    const user = await requireUser();
    const parsed = changeStageInputSchema.safeParse(rawInput);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        status: 'error',
        message: firstIssue?.message ?? 'Invalid stage change request.',
      };
    }

    const updated = await changePipelineStageRecord(
      user.id,
      parsed.data.pipeline_id,
      parsed.data.to_stage_id,
      parsed.data.reason,
    );

    invalidateTags(CACHE_TAGS.pipelines, CACHE_TAGS.dashboard);
    revalidatePath('/pipelines');
    revalidatePath(`/pipelines/${parsed.data.pipeline_id}`);
    revalidatePath('/dashboard');

    return {
      status: 'success',
      id: updated.id,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to change pipeline stage.',
    };
  }
}

export async function recordPipelineReceiptAction(
  rawInput: RecordReceiptInput,
): Promise<PipelineActionResult> {
  try {
    const user = await requireUser();
    const parsed = recordReceiptInputSchema.safeParse(rawInput);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        status: 'error',
        message: firstIssue?.message ?? 'Check the receipt fields and try again.',
      };
    }

    const created = await addPipelineReceiptRecord(user.id, parsed.data);

    invalidateTags(CACHE_TAGS.receipts, CACHE_TAGS.pipelines, CACHE_TAGS.dashboard);
    revalidatePath('/pipelines');
    revalidatePath(`/pipelines/${parsed.data.pipeline_id}`);
    revalidatePath('/dashboard');

    return {
      status: 'success',
      id: created.id,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to record receipt.',
    };
  }
}
