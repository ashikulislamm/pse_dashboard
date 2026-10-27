'use server';

import { revalidatePath } from 'next/cache';
import { CACHE_TAGS, invalidateTags } from '@/shared/lib/cache';
import { requireUser } from '@/shared/lib/rbac';
import type { ContactType } from '@/types/database';
import {
  createContactRecord,
  findByNormalizedChannels,
  searchContactsLite,
  updateContactRecord,
  type ContactLiteOption,
  type DuplicateContactMatch,
} from './repository';
import { contactFormSchema, type ContactFormInput } from './schema';
import { prepareContactPayload } from './service';

export type SaveContactResult =
  | {
      status: 'saved';
      contact: { id: string; name: string; type: ContactType };
    }
  | {
      status: 'duplicate';
      existing: DuplicateContactMatch;
    }
  | {
      status: 'error';
      message: string;
    };

export async function createContactAction(
  input: ContactFormInput,
): Promise<SaveContactResult> {
  try {
    const user = await requireUser();
    const parsed = contactFormSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'error',
        message: parsed.error.issues[0]?.message ?? 'Invalid contact fields.',
      };
    }

    const payload = prepareContactPayload(parsed.data);

    const dup = await findByNormalizedChannels(user.id, payload.channels);
    if (dup) {
      return {
        status: 'duplicate',
        existing: dup,
      };
    }

    const contact = await createContactRecord(user.id, payload);
    invalidateTags(CACHE_TAGS.contacts, CACHE_TAGS.dashboard);
    revalidatePath('/contacts');

    return {
      status: 'saved',
      contact,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to create contact.',
    };
  }
}

export async function updateContactAction(
  contactId: string,
  input: ContactFormInput,
): Promise<SaveContactResult> {
  try {
    const user = await requireUser();
    const parsed = contactFormSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'error',
        message: parsed.error.issues[0]?.message ?? 'Invalid contact fields.',
      };
    }

    const payload = prepareContactPayload(parsed.data);

    const dup = await findByNormalizedChannels(user.id, payload.channels, contactId);
    if (dup) {
      return {
        status: 'duplicate',
        existing: dup,
      };
    }

    const contact = await updateContactRecord(user.id, contactId, payload);
    invalidateTags(CACHE_TAGS.contacts, CACHE_TAGS.dashboard);
    revalidatePath('/contacts');
    revalidatePath(`/contacts/${contactId}`);

    return {
      status: 'saved',
      contact,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to update contact.',
    };
  }
}

export async function searchContactsAction(
  q = '',
  allowedType?: ContactType,
): Promise<ContactLiteOption[]> {
  const user = await requireUser();
  return searchContactsLite(user.id, q, allowedType);
}
