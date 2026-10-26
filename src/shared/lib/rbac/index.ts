import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { queryDb } from '@/shared/lib/supabase/admin';
import type { AppRole, Database } from '@/types/database';
import { SESSION_COOKIE_NAME, verifySessionToken } from './session';

export type AuthenticatedProfile = Database['public']['Tables']['profiles']['Row'] & {
  email?: string;
};

export class AuthorizationError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

/**
 * Verifies that the current request has a valid signed session cookie (`pse_session`)
 * AND belongs to an active PSE team member in PostgreSQL (`is_pse = true` and `is_active = true`).
 * Redirects unauthenticated users to `/login` and non-PSE users to `/no-access`.
 */
export async function requireUser(): Promise<AuthenticatedProfile> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(rawToken);

  if (!session) {
    redirect('/login');
  }

  const { rows } = await queryDb<Database['public']['Tables']['profiles']['Row']>(
    `SELECT id, full_name, role, team_id, is_pse, is_active
     FROM profiles
     WHERE id = $1
     LIMIT 1`,
    [session.userId],
  );

  const profile = rows[0];

  if (!profile || !profile.is_pse || !profile.is_active) {
    redirect('/no-access');
  }

  return {
    ...profile,
    email: session.email,
  };
}

/**
 * Verifies that the authenticated PSE user holds one of the allowed `roles`.
 * Throws `AuthorizationError` if the user's role is not in `allowedRoles`.
 */
export async function requireRole(...allowedRoles: AppRole[]): Promise<AuthenticatedProfile> {
  const profile = await requireUser();

  if (!allowedRoles.includes(profile.role)) {
    throw new AuthorizationError(
      `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}.`,
      403,
    );
  }

  return profile;
}

export {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  hashPassword,
  verifyPassword,
  type SessionPayload,
} from './session';
