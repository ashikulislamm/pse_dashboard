import { getAuthenticatedUser, signOutAction } from '@/modules/auth';
import { AppShell } from '@/shared/ui';

export const dynamic = 'force-dynamic';

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  return (
    <AppShell
      user={{
        fullName: user.full_name,
        role: user.role,
      }}
      onSignOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
