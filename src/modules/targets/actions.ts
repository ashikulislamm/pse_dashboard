'use server';

import { revalidatePath } from 'next/cache';
import { CACHE_TAGS, invalidateTags } from '@/shared/lib/cache';
import { requireRole } from '@/shared/lib/rbac';
import { deleteTargetDraft, publishTargetPlanRecord, saveTargetDraft } from './repository';
import { targetPlanDraftSchema, targetYearSchema, type TargetPlanDraft } from './schema';
import { validatePlan } from './service';

export type TargetActionResult =
  { status: 'success'; planId: string } | { status: 'error'; message: string };

function friendlyError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (/row-level security/i.test(message)) {
    return 'You do not have permission to manage targets.';
  }
  if (/target_plans_year_team_id_key|duplicate key/i.test(message)) {
    return 'A target plan for this year already exists. Reload the page to continue it.';
  }
  return message;
}

function refreshTargets() {
  invalidateTags(CACHE_TAGS.targets, CACHE_TAGS.dashboard);
  revalidatePath('/targets');
  revalidatePath('/dashboard');
}

/** Saves the wizard state as a draft. Totals are only enforced when publishing. */
export async function saveTargetDraftAction(
  rawInput: TargetPlanDraft,
): Promise<TargetActionResult> {
  try {
    const user = await requireRole('admin', 'target_manager');
    const parsed = targetPlanDraftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        status: 'error',
        message: parsed.error.issues[0]?.message ?? 'Check the target values and try again.',
      };
    }

    const { planId } = await saveTargetDraft(user.id, user.team_id, parsed.data);
    refreshTargets();
    return { status: 'success', planId };
  } catch (err) {
    return { status: 'error', message: friendlyError(err, 'Failed to save the target draft.') };
  }
}

/**
 * Saves the draft, then publishes (locks) it. The service validates first for clear messages;
 * `publish_target_plan` is the final authority and re-checks every total in the database.
 */
export async function publishTargetPlanAction(
  rawInput: TargetPlanDraft,
): Promise<TargetActionResult> {
  try {
    const user = await requireRole('admin', 'target_manager');
    const parsed = targetPlanDraftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        status: 'error',
        message: parsed.error.issues[0]?.message ?? 'Check the target values and try again.',
      };
    }

    const issues = validatePlan(parsed.data);
    if (issues.length > 0) {
      return { status: 'error', message: issues[0].message };
    }

    const { planId } = await saveTargetDraft(user.id, user.team_id, parsed.data);
    await publishTargetPlanRecord(user.id, planId);
    refreshTargets();
    return { status: 'success', planId };
  } catch (err) {
    return { status: 'error', message: friendlyError(err, 'Failed to publish the target plan.') };
  }
}

export async function discardTargetDraftAction(
  year: number,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  try {
    const user = await requireRole('admin', 'target_manager');
    const parsedYear = targetYearSchema.safeParse(year);
    if (!parsedYear.success) {
      return { status: 'error', message: 'Select a valid year.' };
    }
    await deleteTargetDraft(user.id, user.team_id, parsedYear.data);
    refreshTargets();
    return { status: 'success' };
  } catch (err) {
    return { status: 'error', message: friendlyError(err, 'Failed to discard the draft.') };
  }
}
