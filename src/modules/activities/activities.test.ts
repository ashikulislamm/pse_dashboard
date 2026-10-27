import { describe, expect, it } from 'vitest';
import {
  canEditActivity,
  defaultActivityClassForType,
  prepareActivityPayload,
} from './service';

describe('activities service', () => {
  it('maps activity types to their default non-monetary reporting class', () => {
    expect(defaultActivityClassForType('servicing')).toBe('stewardship');
    expect(defaultActivityClassForType('prospect_engagement')).toBe(
      'prospect_engagement',
    );
    expect(defaultActivityClassForType('task')).toBe('independent');
    expect(defaultActivityClassForType('visit')).toBe('independent');
    expect(defaultActivityClassForType('event')).toBe('independent');
    expect(defaultActivityClassForType('general')).toBe('independent');
  });

  it('allows an independent activity with zero contact/pipeline/meeting links', () => {
    const prepared = prepareActivityPayload({
      title: 'Annual Private Sector Forum Booth Preparation',
      type: 'event',
      owner_id: '11111111-1111-4111-8111-111111111111',
      related_org_name: 'Dhaka Chamber of Commerce',
      status: 'in_progress',
      remaining_work: 'Finalize printed brochures by Tuesday',
      occurred_at: '2026-03-18',
    });

    expect(prepared.class).toBe('independent');
    expect(prepared.contact_id).toBeNull();
    expect(prepared.pipeline_id).toBeNull();
    expect(prepared.meeting_id).toBeNull();
    expect(prepared.related_org_name).toBe('Dhaka Chamber of Commerce');
    expect(prepared.remaining_work).toBe('Finalize printed brochures by Tuesday');
  });

  it('respects user-overridden activity class and preserves meeting follow-up links', () => {
    const prepared = prepareActivityPayload({
      title: 'Send revised MoU draft after Q1 alignment meeting',
      type: 'email',
      class: 'stewardship',
      owner_id: '11111111-1111-4111-8111-111111111111',
      contact_id: '22222222-2222-4222-8222-222222222222',
      pipeline_id: '33333333-3333-4333-8333-333333333333',
      meeting_id: '44444444-4444-4444-8444-444444444444',
      status: 'planned',
    });

    expect(prepared.class).toBe('stewardship');
    expect(prepared.meeting_id).toBe('44444444-4444-4444-8444-444444444444');
  });

  it('enforces owner / admin write check', () => {
    expect(canEditActivity({ id: 'u-1', role: 'member' }, { owner_id: 'u-1' })).toBe(
      true,
    );
    expect(canEditActivity({ id: 'u-2', role: 'member' }, { owner_id: 'u-1' })).toBe(
      false,
    );
    expect(canEditActivity({ id: 'u-2', role: 'admin' }, { owner_id: 'u-1' })).toBe(
      true,
    );
  });
});
