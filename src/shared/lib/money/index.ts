/**
 * Rounds a number to 2 decimal places using standard half-to-even / half-up cents math.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converts an amount in a given currency to the base currency (BDT)
 * using the provided exchange rate (rate_to_base).
 */
export function toBase(amount: number, currency: string, fxRate = 1): number {
  if (amount < 0 || !Number.isFinite(amount)) {
    throw new Error('Amount must be a non-negative finite number');
  }
  if (currency.toUpperCase() === 'BDT') {
    return roundCurrency(amount);
  }
  if (fxRate <= 0 || !Number.isFinite(fxRate)) {
    throw new Error(`Invalid FX rate for ${currency}`);
  }
  return roundCurrency(amount * fxRate);
}

/**
 * Allocates `total` across `percents` using the Largest Remainder Method
 * at 2 decimal places (cents/poisha), guaranteeing that the sum of the
 * returned amounts equals `roundCurrency(total)` with zero rounding drift.
 */
export function allocateByPercent(total: number, percents: number[]): number[] {
  if (percents.length === 0) return [];
  if (total < 0 || !Number.isFinite(total)) {
    throw new Error('Total must be a non-negative finite number');
  }

  const percentSum = percents.reduce((acc, p) => acc + p, 0);
  if (Math.abs(percentSum - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100 (received ${percentSum})`);
  }

  for (const p of percents) {
    if (p < 0 || p > 100 || !Number.isFinite(p)) {
      throw new Error(`Each percentage must be between 0 and 100 (received ${p})`);
    }
  }

  const totalCents = Math.round(roundCurrency(total) * 100);
  const rawCents = percents.map((p) => (totalCents * p) / 100);
  const flooredCents = rawCents.map((c) => Math.floor(c));
  const remainders = rawCents.map((c, idx) => ({
    index: idx,
    remainder: c - flooredCents[idx],
  }));

  const remainingCents = totalCents - flooredCents.reduce((a, b) => a + b, 0);

  remainders.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return a.index - b.index;
  });

  for (let i = 0; i < remainingCents; i++) {
    const targetIdx = remainders[i % remainders.length].index;
    flooredCents[targetIdx] += 1;
  }

  return flooredCents.map((cents) => cents / 100);
}
