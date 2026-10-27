import * as React from 'react';
import { cn } from '@/shared/lib/utils';

const BDT_FORMATTER = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const STANDARD_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatMoney(
  amount: number | null | undefined,
  currency = 'BDT',
  baseAmount?: number | null,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }

  const code = currency.toUpperCase();
  const formattedOriginal =
    code === 'BDT'
      ? `৳ ${BDT_FORMATTER.format(amount)}`
      : `${code} ${STANDARD_FORMATTER.format(amount)}`;

  if (
    code !== 'BDT' &&
    baseAmount !== undefined &&
    baseAmount !== null &&
    !Number.isNaN(baseAmount)
  ) {
    return `${formattedOriginal} (৳ ${BDT_FORMATTER.format(baseAmount)})`;
  }

  return formattedOriginal;
}

export interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | null | undefined;
  currency?: string;
  baseAmount?: number | null;
}

/**
 * Canonical money formatter component (DESIGN.md §4 & §13.3).
 * Always renders with `tabular-nums`. Missing values render as `—`.
 */
export function Money({
  amount,
  currency = 'BDT',
  baseAmount,
  className,
  ...props
}: MoneyProps) {
  return (
    <span className={cn('tabular-nums whitespace-nowrap', className)} {...props}>
      {formatMoney(amount, currency, baseAmount)}
    </span>
  );
}

const COMPACT_FORMATTER = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

/**
 * Compact number for chart axes only (`1.25M`). DESIGN.md §4: the full value must always be
 * available elsewhere (table or tooltip), so never use this for figures a user reads as the answer.
 */
export function formatCompactNumber(value: number): string {
  return COMPACT_FORMATTER.format(value);
}
