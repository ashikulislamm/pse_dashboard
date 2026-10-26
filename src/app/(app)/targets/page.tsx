import { EmptyState, PageHeader } from '@/shared/ui';

export default function TargetsPage() {
  return (
    <div>
      <PageHeader
        title="Targets"
        description="Annual, quarterly, member, and vertical fundraising target allocation."
      />
      <EmptyState message="No target plan configured for the current year." />
    </div>
  );
}
