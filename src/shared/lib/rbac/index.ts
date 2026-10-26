import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';
import type { AppRole, Database } from '@/types/database';

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
 * Verifies that the current request has an authenticated Supabase session AND
 * belongs to an active PSE team member (`is_pse = true` and `is_active = true`).
 * Redirects unauthenticated users to `/login` and non-PSE users to `/no-access`.
 */
export async function requireUser(): Promise<AuthenticatedProfile> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Database['public']['Tables']['profiles']['Row']>();

  if (profileError || !profile || !profile.is_pse || !profile.is_active) {
    redirect('/no-access');
  }

  return {
    ...profile,
    email: user.email,
  };
}

/**
 * Verifies that the authenticated PSE user holds one of the allowed `roles`.
 * Throws `AuthorizationError` when used inside Server Actions, or redirects/blocks when unauthorized.
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
