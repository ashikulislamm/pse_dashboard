import { notFound } from 'next/navigation';
import {
  canEditContact,
  ContactDetailView,
  getContactDetailPageData,
} from '@/modules/contacts';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { currentUser, contact, companyOptions } = await getContactDetailPageData(id);

  if (!contact) {
    notFound();
  }

  const canEdit = canEditContact(currentUser, contact);

  return (
    <ContactDetailView
      contact={contact}
      canEdit={canEdit}
      companyOptions={companyOptions}
    />
  );
}
