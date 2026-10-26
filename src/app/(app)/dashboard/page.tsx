import { EmptyState, PageHeader } from '@/shared/ui';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Monetary fundraising performance and non-monetary work metrics."
      />
      <EmptyState
        message="No data for this period. Connect Supabase in Phase 2 to load live metrics."
        actionLabel="View contacts"
        actionHref="/contacts"
      />
    </div>
  );
}
