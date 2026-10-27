import { describe, expect, it } from 'vitest';
import {
  canEditMeeting,
  deriveMeetingContactInfo,
  prepareMeetingPayload,
} from './service';

describe('meetings service', () => {
  it('rejects a meeting with neither contact_id nor pipeline_id', () => {
    expect(() =>
      prepareMeetingPayload({
        contact_id: null,
        pipeline_id: null,
        scheduled_at: '2026-04-15T10:00:00Z',
        status: 'scheduled',
        owner_id: '11111111-1111-4111-8111-111111111111',
      }),
    ).toThrow(/contact or a pipeline/i);
  });

  it('accepts a meeting linked only to a pipeline or only to a contact', () => {
    const pipelineOnly = prepareMeetingPayload({
      contact_id: '',
      pipeline_id: '22222222-2222-4222-8222-222222222222',
      scheduled_at: '2026-04-15T10:00:00Z',
      status: 'scheduled',
      description: 'Quarterly alignment review',
      owner_id: '11111111-1111-4111-8111-111111111111',
    });

    expect(pipelineOnly.contact_id).toBeNull();
    expect(pipelineOnly.pipeline_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(pipelineOnly.description).toBe('Quarterly alignment review');
  });

  it('derives organization and designation from direct contact or fallback pipeline contact', () => {
    const fromDirectIndividual = deriveMeetingContactInfo({
      directContact: {
        id: 'c-1',
        name: 'Farhana Rahman',
        type: 'individual',
        organization_name: 'Apex Footwear Ltd',
        designation: 'Head of CSR',
      },
      pipelineContact: null,
    });
    expect(fromDirectIndividual).toEqual({
      effectiveContactId: 'c-1',
      contactName: 'Farhana Rahman',
      contactType: 'individual',
      organizationName: 'Apex Footwear Ltd',
      designation: 'Head of CSR',
    });

    const fromPipelineFallback = deriveMeetingContactInfo({
      directContact: null,
      pipelineContact: {
        id: 'c-2',
        name: 'Square Pharmaceuticals PLC',
        type: 'company',
        organization_name: null,
        designation: null,
      },
    });
    expect(fromPipelineFallback).toEqual({
      effectiveContactId: 'c-2',
      contactName: 'Square Pharmaceuticals PLC',
      contactType: 'company',
      organizationName: 'Square Pharmaceuticals PLC',
      designation: null,
    });
  });

  it('enforces owner / admin write check', () => {
    expect(canEditMeeting({ id: 'u-1', role: 'member' }, { owner_id: 'u-1' })).toBe(true);
    expect(canEditMeeting({ id: 'u-2', role: 'member' }, { owner_id: 'u-1' })).toBe(false);
    expect(canEditMeeting({ id: 'u-2', role: 'admin' }, { owner_id: 'u-1' })).toBe(true);
  });
});
