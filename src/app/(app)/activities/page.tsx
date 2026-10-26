import { EmptyState, PageHeader } from '@/shared/ui';

export default function ActivitiesPage() {
  return (
    <div>
      <PageHeader
        title="Activities"
        description="Stewardship, prospect engagement, events, campaigns, visits, and tasks."
      />
      <EmptyState message="No activities recorded yet." />
    </div>
  );
}
