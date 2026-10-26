import { EmptyState, PageHeader } from '@/shared/ui';

export default function ContactsPage() {
  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Donors, sponsors, partner organizations, and points of contact."
      />
      <EmptyState message="No contacts yet. Create the first one." />
    </div>
  );
}
