import Link from 'next/link';
import {
  AdminUsersPanel,
  canAccessAdmin,
  getAdminPageData,
  getAuthenticatedUser,
} from '@/modules/auth';
import { Card, PageHeader } from '@/shared/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getAuthenticatedUser();

  if (!canAccessAdmin(user.role)) {
    return (
      <div>
        <PageHeader title="Admin" />
        <Card title="No permission">
          <p className="text-[14px] leading-5 text-muted-foreground">
            You don&apos;t have access to this page.
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard"
              className="text-[13px] font-medium text-primary underline hover:text-primary-hover"
            >
              Return to dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { profiles, config } = await getAdminPageData();

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Manage PSE team roles, department access, and reference configuration."
      />
      <AdminUsersPanel
        currentUserId={user.id}
        profiles={profiles}
        stages={config.stages}
        categoryMap={config.categoryMap}
        fxRates={config.fxRates}
      />
    </div>
  );
}
