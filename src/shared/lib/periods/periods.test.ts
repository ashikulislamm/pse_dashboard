import { describe, expect, it } from 'vitest';
import { periodRange, quarterOf } from './index';

describe('periodRange', () => {
  it('computes calendar month range and marks isProRata = true', () => {
    const oct = periodRange({ type: 'month', year: 2026, index: 10 });
    expect(oct).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
      label: 'Oct 2026',
      isProRata: true,
    });
  });

  it('computes calendar quarter range', () => {
    const q1 = periodRange({ type: 'quarter', year: 2026, index: 1 });
    expect(q1).toEqual({
      start: '2026-01-01',
      end: '2026-03-31',
      label: 'Q1 2026',
      isProRata: false,
    });

    const q4 = periodRange({ type: 'quarter', year: 2026, index: 4 });
    expect(q4).toEqual({
      start: '2026-10-01',
      end: '2026-12-31',
      label: 'Q4 2026',
      isProRata: false,
    });
  });

  it('computes calendar year range', () => {
    const yr = periodRange({ type: 'year', year: 2026 });
    expect(yr).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
      label: '2026',
      isProRata: false,
    });
  });

  it('supports custom fiscalStartMonth (e.g., July = 7)', () => {
    const q1Fiscal = periodRange({ type: 'quarter', year: 2026, index: 1, fiscalStartMonth: 7 });
    expect(q1Fiscal.start).toBe('2026-07-01');
    expect(q1Fiscal.end).toBe('2026-09-30');
  });
});

describe('quarterOf', () => {
  it('returns correct quarter for calendar year', () => {
    expect(quarterOf('2026-01-15')).toBe(1);
    expect(quarterOf('2026-05-01')).toBe(2);
    expect(quarterOf('2026-08-20')).toBe(3);
    expect(quarterOf('2026-10-26')).toBe(4);
  });
});
