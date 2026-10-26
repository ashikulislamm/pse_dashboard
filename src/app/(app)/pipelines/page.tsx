import { EmptyState, PageHeader } from '@/shared/ui';

export default function PipelinesPage() {
  return (
    <div>
      <PageHeader
        title="Pipelines"
        description="Expected financial contributions, valued in-kind opportunities, and realized receipts."
      />
      <EmptyState message="No pipelines yet. Create the first one." />
    </div>
  );
}
