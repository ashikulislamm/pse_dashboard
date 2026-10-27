import { describe, expect, it } from 'vitest';
import { contactFormSchema } from './schema';
import {
  canEditContact,
  normalizeContactChannels,
  prepareContactPayload,
} from './service';

describe('contacts schema and business rules', () => {
  it('rejects a contact with zero channels', () => {
    const res = contactFormSchema.safeParse({
      type: 'individual',
      name: 'No Channel Person',
      channels: [],
    });
    expect(res.success).toBe(false);
  });

  it('rejects invalid email or phone channel values', () => {
    const badEmail = contactFormSchema.safeParse({
      type: 'individual',
      name: 'Bad Email',
      channels: [{ kind: 'email', value: 'not-an-email', is_primary: true }],
    });
    expect(badEmail.success).toBe(false);

    const badPhone = contactFormSchema.safeParse({
      type: 'individual',
      name: 'Bad Phone',
      channels: [{ kind: 'phone', value: '123', is_primary: true }],
    });
    expect(badPhone.success).toBe(false);
  });

  it('allows an individual without an organization_id', () => {
    const parsed = contactFormSchema.parse({
      type: 'individual',
      name: 'Independent Donor',
      organization_id: null,
      designation: 'Advisor',
      channels: [{ kind: 'email', value: 'Donor@Example.org', is_primary: true }],
    });

    const prepared = prepareContactPayload(parsed);
    expect(prepared.type).toBe('individual');
    expect(prepared.organization_id).toBeNull();
    expect(prepared.designation).toBe('Advisor');
    expect(prepared.channels[0].value_normalized).toBe('donor@example.org');
  });

  it('normalizes phone numbers to E.164 and deduplicates repeated channels', () => {
    const channels = normalizeContactChannels([
      { kind: 'phone', value: '01712-345678', is_primary: false },
      { kind: 'phone', value: '+8801712345678', is_primary: true },
      { kind: 'email', value: '  Test@Example.COM ', is_primary: true },
    ]);

    expect(channels).toHaveLength(2);
    expect(channels[0].value_normalized).toBe('+8801712345678');
    expect(channels[0].is_primary).toBe(true);
    expect(channels[1].value_normalized).toBe('test@example.com');
    expect(channels[1].is_primary).toBe(false);
  });

  it('clears individual-only fields when preparing a company contact', () => {
    const prepared = prepareContactPayload({
      type: 'company',
      name: 'Apex Textiles Ltd',
      organization_id: '20000000-0000-0000-0000-000000000001',
      designation: 'Should Be Cleared',
      website: 'https://apextextiles.example.com',
      industry: 'RMG & Textiles',
      notes: 'Key corporate sponsor',
      status: 'active',
      channels: [{ kind: 'email', value: 'info@apextextiles.example.com', is_primary: true }],
    });

    expect(prepared.organization_id).toBeNull();
    expect(prepared.designation).toBeNull();
    expect(prepared.website).toBe('https://apextextiles.example.com');
    expect(prepared.industry).toBe('RMG & Textiles');
  });

  it('allows owner or admin to edit a contact', () => {
    const ownerId = '10000000-0000-0000-0000-000000000003';
    const otherId = '10000000-0000-0000-0000-000000000004';
    expect(canEditContact({ id: ownerId, role: 'member' }, { owner_id: ownerId })).toBe(true);
    expect(canEditContact({ id: otherId, role: 'member' }, { owner_id: ownerId })).toBe(false);
    expect(canEditContact({ id: otherId, role: 'admin' }, { owner_id: ownerId })).toBe(true);
  });
});
