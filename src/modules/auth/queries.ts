import { requireRole, requireUser } from '@/shared/lib/rbac';
import {
  getReferenceConfigSummary,
  listAllProfiles,
  listPseTeamMembers,
} from './repository';

export async function getAuthenticatedUser() {
  return requireUser();
}

export async function getActivePseTeamMembers() {
  await requireUser();
  return listPseTeamMembers();
}

export async function getAdminPageData() {
  await requireRole('admin');
  const [profiles, config] = await Promise.all([
    listAllProfiles(),
    getReferenceConfigSummary(),
  ]);
  return {
    profiles,
    config,
  };
}
