import { normalizeEmail, normalizePhone } from '@/shared/lib/phone';
import type { AppRole, ChannelKind, ContactStatus, ContactType } from '@/types/database';
import type { ContactChannelInput, ContactFormInput } from './schema';

export interface NormalizedChannel {
  kind: ChannelKind;
  value: string;
  value_normalized: string;
  is_primary: boolean;
}

export interface PreparedContactPayload {
  type: ContactType;
  name: string;
  organization_id: string | null;
  designation: string | null;
  website: string | null;
  industry: string | null;
  notes: string | null;
  status: ContactStatus;
  channels: NormalizedChannel[];
}

/** Normalises and dedupes channels so exactly one is primary. */
export function normalizeContactChannels(
  rawChannels: ContactChannelInput[],
): NormalizedChannel[] {
  if (rawChannels.length === 0) {
    throw new Error('Contact needs at least one email or phone.');
  }

  const seen = new Map<string, number>();
  const normalized: NormalizedChannel[] = [];

  for (const ch of rawChannels) {
    const trimmed = ch.value.trim();
    const normValue =
      ch.kind === 'email' ? normalizeEmail(trimmed) : normalizePhone(trimmed);

    if (!normValue) {
      throw new Error(
        ch.kind === 'email'
          ? `Invalid email address: "${ch.value}".`
          : `Invalid phone number: "${ch.value}".`,
      );
    }

    const dedupeKey = `${ch.kind}:${normValue}`;
    const existingIdx = seen.get(dedupeKey);
    if (existingIdx !== undefined) {
      if (ch.is_primary) {
        normalized[existingIdx].is_primary = true;
      }
      continue;
    }
    seen.set(dedupeKey, normalized.length);

    normalized.push({
      kind: ch.kind,
      value: trimmed,
      value_normalized: normValue,
      is_primary: Boolean(ch.is_primary),
    });
  }

  if (normalized.length === 0) {
    throw new Error('Contact needs at least one email or phone.');
  }

  const hasPrimary = normalized.some((c) => c.is_primary);
  if (!hasPrimary) {
    normalized[0].is_primary = true;
  } else {
    let assignedPrimary = false;
    for (const c of normalized) {
      if (c.is_primary && !assignedPrimary) {
        assignedPrimary = true;
      } else {
        c.is_primary = false;
      }
    }
  }

  return normalized;
}

/** Cleans contact input. Individuals keep organization and designation; companies keep website and industry. */
export function prepareContactPayload(input: ContactFormInput): PreparedContactPayload {
  const channels = normalizeContactChannels(input.channels);
  const cleanStr = (val?: string | null) => {
    const t = val?.trim();
    return t ? t : null;
  };

  if (input.type === 'individual') {
    return {
      type: 'individual',
      name: input.name.trim(),
      organization_id: input.organization_id || null,
      designation: cleanStr(input.designation),
      website: null,
      industry: null,
      notes: cleanStr(input.notes),
      status: input.status ?? 'active',
      channels,
    };
  }

  return {
    type: 'company',
    name: input.name.trim(),
    organization_id: null,
    designation: null,
    website: cleanStr(input.website),
    industry: cleanStr(input.industry),
    notes: cleanStr(input.notes),
    status: input.status ?? 'active',
    channels,
  };
}

/** Only the owner or an admin can edit a contact. */
export function canEditContact(
  actor: { id: string; role: AppRole },
  contact: { owner_id: string | null },
): boolean {
  return actor.role === 'admin' || contact.owner_id === actor.id;
}
