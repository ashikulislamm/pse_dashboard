import { describe, expect, it } from 'vitest';
import { allocateByPercent, roundCurrency, toBase } from './index';

describe('toBase', () => {
  it('returns exact rounded BDT amount when currency is BDT', () => {
    expect(toBase(1250000, 'BDT', 1)).toBe(1250000);
  });

  it('converts foreign currency using fxRate', () => {
    expect(toBase(5000, 'USD', 120.5)).toBe(602500);
  });

  it('throws on invalid FX rate for non-BDT currency', () => {
    expect(() => toBase(100, 'USD', 0)).toThrow();
  });
});

describe('allocateByPercent', () => {
  it('reconciles 33.333% splits without losing 0.01', () => {
    const result = allocateByPercent(100, [33.333, 33.333, 33.334]);
    const sum = roundCurrency(result.reduce((a, b) => a + b, 0));
    expect(sum).toBe(100);
    expect(result).toEqual([33.33, 33.33, 33.34]);
  });

  it('allocates large BDT quarterly amounts accurately across 3 verticals', () => {
    const total = 1000000;
    const result = allocateByPercent(total, [50, 30, 20]);
    expect(result).toEqual([500000, 300000, 200000]);
  });

  it('throws if percentages do not sum to 100', () => {
    expect(() => allocateByPercent(1000, [40, 40])).toThrow(/sum to 100/);
  });
});
