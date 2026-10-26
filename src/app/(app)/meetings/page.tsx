import { EmptyState, PageHeader } from '@/shared/ui';

export default function MeetingsPage() {
  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Scheduled and completed donor and partner meetings."
      />
      <EmptyState message="No meetings scheduled yet." />
    </div>
  );
}
