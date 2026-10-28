import type { AppRole } from '@/types/database';

/** Pure auth and role rules. */
export function canAccessAdmin(role: AppRole): boolean {
  return role === 'admin';
}

export function canManageTargets(role: AppRole): boolean {
  return role === 'admin' || role === 'target_manager';
}

export function validateSelfUpdateGuard(
  actorId: string,
  targetUserId: string,
  nextRole: AppRole,
  nextIsActive: boolean,
  nextIsPse: boolean,
): string | null {
  if (actorId === targetUserId) {
    if (nextRole !== 'admin') {
      return 'You cannot remove your own admin role.';
    }
    if (!nextIsActive || !nextIsPse) {
      return 'You cannot deactivate or remove your own PSE access.';
    }
  }
  return null;
}
