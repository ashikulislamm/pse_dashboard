import { describe, expect, it } from 'vitest';
import { normalizeEmail, normalizePhone } from './index';

describe('normalizePhone', () => {
  it('normalizes local BD phone numbers to E.164', () => {
    expect(normalizePhone('01712-345678')).toBe('+8801712345678');
    expect(normalizePhone('01712345678')).toBe('+8801712345678');
  });

  it('normalizes international numbers with country code', () => {
    expect(normalizePhone('+880 1712 345678')).toBe('+8801712345678');
    expect(normalizePhone('+1 (415) 555-2671', 'US')).toBe('+14155552671');
  });

  it('returns null for invalid phone numbers', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('abc-def')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases valid emails', () => {
    expect(normalizeEmail('  Donor.Name@Example.ORG ')).toBe('donor.name@example.org');
  });

  it('returns null for invalid emails', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('missing@domain')).toBeNull();
  });
});
