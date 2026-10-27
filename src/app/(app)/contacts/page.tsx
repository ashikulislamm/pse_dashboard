import { ContactsView, getContactsListPageData } from '@/modules/contacts';

export default async function ContactsPage() {
  const { contacts, companies, industries, companyOptions } =
    await getContactsListPageData();

  return (
    <ContactsView
      contacts={contacts}
      companies={companies}
      industries={industries}
      companyOptions={companyOptions}
    />
  );
}
