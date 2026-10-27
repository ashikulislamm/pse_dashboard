import { CACHE_TAGS, cached } from '@/shared/lib/cache';
import { requireRole, requireUser } from '@/shared/lib/rbac';
import {
  getReferenceConfigSummary,
  listAllProfiles,
  listPseTeamMembers,
} from './repository';

const loadActivePseTeamMembers = cached(
  async () => listPseTeamMembers(),
  ['auth-active-pse-members'],
  [CACHE_TAGS.config],
);

const loadReferenceConfigSummary = cached(
  async () => getReferenceConfigSummary(),
  ['auth-reference-config-summary'],
  [CACHE_TAGS.config],
);

export async function getAuthenticatedUser() {
  return requireUser();
}

export async function getActivePseTeamMembers() {
  await requireUser();
  return loadActivePseTeamMembers();
}

export async function getAdminPageData() {
  await requireRole('admin');
  const [profiles, config] = await Promise.all([
    listAllProfiles(),
    loadReferenceConfigSummary(),
  ]);
  return {
    profiles,
    config,
  };
}
