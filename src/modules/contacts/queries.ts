'use server';

import { requireUser } from '@/shared/lib/rbac';
import type { ContactType } from '@/types/database';
import {
  getContactDetail,
  listContacts,
  listFilterMetadata,
  searchContactsLite,
} from './repository';
import type { ContactFilters } from './schema';

export async function getContactsListPageData(filters: ContactFilters = {}) {
  const user = await requireUser();
  const [contacts, meta, companyOptions] = await Promise.all([
    listContacts(user.id, filters),
    listFilterMetadata(user.id),
    searchContactsLite(user.id, '', 'company'),
  ]);

  return {
    currentUser: user,
    contacts,
    companies: meta.companies,
    industries: meta.industries,
    companyOptions,
  };
}

export async function getContactDetailPageData(contactId: string) {
  const user = await requireUser();
  const [contact, companyOptions] = await Promise.all([
    getContactDetail(user.id, contactId),
    searchContactsLite(user.id, '', 'company'),
  ]);

  return {
    currentUser: user,
    contact,
    companyOptions,
  };
}

export async function getContactPickerInitialOptions(allowedType?: ContactType) {
  const user = await requireUser();
  return searchContactsLite(user.id, '', allowedType);
}
