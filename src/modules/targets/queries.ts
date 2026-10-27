'use server';

import { requireUser } from '@/shared/lib/rbac';
import {
  getTargetPlan,
  listTargetMembers,
  listTargetPlanYears,
  listTargetVerticals,
} from './repository';
import { allocationsFromLines, canManageTargets } from './service';
import type { TargetPlanDraft } from './schema';

export async function getTargetsPageData(requestedYear?: number) {
  const user = await requireUser();
  const canManage = canManageTargets(user.role);
  const currentYear = new Date().getFullYear();
  const year = requestedYear ?? currentYear;

  const [plan, verticals, planYears] = await Promise.all([
    // Members only ever see published plans; drafts are for the people who manage them.
    getTargetPlan(user.id, user.team_id, year, canManage),
    listTargetVerticals(user.id),
    listTargetPlanYears(user.id, user.team_id, canManage),
  ]);
  // Include everyone with a target line, even if deactivated since, so no row goes missing.
  const members = await listTargetMembers(user.id, [
    ...new Set((plan?.lines ?? []).map((l) => l.user_id)),
  ]);

  const yearOptions = [
    ...new Set([...planYears.map((p) => p.year), currentYear, currentYear + 1, year]),
  ].sort((a, b) => b - a);

  const draft: TargetPlanDraft | null = plan
    ? {
        year: plan.year,
        annual_amount: plan.annual_amount,
        quarters: plan.quarters,
        allocations: allocationsFromLines(plan.lines),
      }
    : null;

  return {
    currentUser: user,
    canManage,
    year,
    yearOptions,
    plan,
    draft,
    members,
    verticals,
  };
}
