'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CACHE_TAGS, invalidateTags } from '@/shared/lib/cache';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  requireRole,
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifyPassword,
} from '@/shared/lib/rbac';
import {
  clearFailedLogins,
  countRecentFailedLogins,
  findProfileWithPasswordByEmail,
  insertProfileAsAdmin,
  recordFailedLogin,
  updateProfileAsAdmin,
} from './repository';
import {
  createUserSchema,
  signInSchema,
  updateUserRoleSchema,
  type CreateUserInput,
  type UpdateUserRoleInput,
} from './schema';
import { validateSelfUpdateGuard } from './service';

const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_WINDOW_MINUTES = 15;

export interface AuthActionState {
  error?: string;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const rawEmail = String(formData.get('email') ?? '');
  const rawPassword = String(formData.get('password') ?? '');

  const parsed = signInSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Enter a valid email and password.',
    };
  }

  const email = parsed.data.email;

  const recentFailures = await countRecentFailedLogins(email, LOGIN_LOCK_WINDOW_MINUTES);
  if (recentFailures >= MAX_FAILED_LOGINS) {
    return {
      error: `Too many failed attempts. Try again in ${LOGIN_LOCK_WINDOW_MINUTES} minutes.`,
    };
  }

  const profile = await findProfileWithPasswordByEmail(email);
  // Always run a password verification (against a dummy hash when the email is unknown)
  // so response time does not reveal whether an account exists.
  const passwordOk = await verifyPassword(
    parsed.data.password,
    profile?.password_hash ?? DUMMY_PASSWORD_HASH,
  );

  if (!profile || !passwordOk) {
    await recordFailedLogin(email);
    return {
      error: 'Invalid email or password.',
    };
  }

  await clearFailedLogins(email);

  if (!profile.is_active) {
    return {
      error: 'Your account is inactive. Contact an administrator.',
    };
  }

  const token = signSessionToken({
    userId: profile.id,
    email: profile.email,
    role: profile.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  if (!profile.is_pse) {
    redirect('/no-access');
  }

  redirect('/dashboard');
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}

export async function createUserAction(
  input: CreateUserInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = await requireRole('admin');
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid user details.',
      };
    }

    await insertProfileAsAdmin(admin.id, {
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      fullName: parsed.data.full_name,
      role: parsed.data.role,
      isPse: parsed.data.is_pse,
    });

    invalidateTags(CACHE_TAGS.config, CACHE_TAGS.dashboard);
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create user.';
    if (/unique|duplicate/i.test(msg)) {
      return { ok: false, error: 'A user with this email already exists.' };
    }
    return { ok: false, error: msg };
  }
}

export async function updateUserRoleAction(
  input: UpdateUserRoleInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = await requireRole('admin');
    const parsed = updateUserRoleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid update parameters.',
      };
    }

    const selfGuardError = validateSelfUpdateGuard(
      admin.id,
      parsed.data.userId,
      parsed.data.role,
      parsed.data.is_active,
      parsed.data.is_pse,
    );
    if (selfGuardError) {
      return { ok: false, error: selfGuardError };
    }

    await updateProfileAsAdmin(admin.id, {
      userId: parsed.data.userId,
      role: parsed.data.role,
      isPse: parsed.data.is_pse,
      isActive: parsed.data.is_active,
    });

    invalidateTags(CACHE_TAGS.config, CACHE_TAGS.dashboard);
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update user.',
    };
  }
}
