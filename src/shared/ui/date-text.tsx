import * as React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/shared/lib/utils';

export function formatDateText(
  value: Date | string | null | undefined,
  includeTime = false,
): string {
  if (!value) return '—';

  const date = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(date)) return '—';

  return includeTime ? format(date, 'd MMM yyyy, h:mm a') : format(date, 'd MMM yyyy');
}

export interface DateTextProps extends React.HTMLAttributes<HTMLTimeElement> {
  value: Date | string | null | undefined;
  includeTime?: boolean;
}

/**
 * Canonical date/time formatter component (DESIGN.md §4 & §13.3).
 * Formats as `26 Oct 2026` or `26 Oct 2026, 3:30 PM` with `tabular-nums`.
 * Missing values render as `—`.
 */
export function DateText({
  value,
  includeTime = false,
  className,
  ...props
}: DateTextProps) {
  const formatted = formatDateText(value, includeTime);
  const iso =
    value instanceof Date && isValid(value)
      ? value.toISOString()
      : typeof value === 'string'
        ? value
        : undefined;

  return (
    <time dateTime={iso} className={cn('tabular-nums whitespace-nowrap', className)} {...props}>
      {formatted}
    </time>
  );
}
