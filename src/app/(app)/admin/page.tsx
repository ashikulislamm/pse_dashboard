import { EmptyState, PageHeader } from '@/shared/ui';

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Admin"
        description="Stages, categories, verticals, currency exchange rates, and team roles."
      />
      <EmptyState message="Reference configuration tables will be seeded in Phase 2." />
    </div>
  );
}
