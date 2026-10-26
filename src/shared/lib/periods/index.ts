export type PeriodType = 'month' | 'quarter' | 'year';

export interface PeriodInput {
  type: PeriodType;
  year: number;
  /**
   * 1–12 for month, 1–4 for quarter, ignored for year.
   */
  index?: number;
  /**
   * Fiscal year start month (1 = January, 7 = July, etc.). Defaults to 1.
   */
  fiscalStartMonth?: number;
}

export interface PeriodRangeResult {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  label: string;
  isProRata: boolean;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmd(year: number, month1Based: number, day: number): string {
  return `${year}-${pad2(month1Based)}-${pad2(day)}`;
}

function lastDayOfMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

/**
 * Adds `monthOffset` months to `(baseYear, baseMonth1Based)` and returns the resulting `(year, month1Based)`.
 */
function addMonths(
  baseYear: number,
  baseMonth1Based: number,
  monthOffset: number,
): { year: number; month: number } {
  const zeroBased = (baseMonth1Based - 1) + monthOffset;
  const yearOffset = Math.floor(zeroBased / 12);
  const month = (((zeroBased % 12) + 12) % 12) + 1;
  return { year: baseYear + yearOffset, month };
}

/**
 * Computes inclusive `{ start, end }` ISO date strings (`YYYY-MM-DD`) and human-readable label
 * for a given period (`month`, `quarter`, or `year`), respecting `fiscalStartMonth` (default 1 = Jan).
 */
export function periodRange(input: PeriodInput): PeriodRangeResult {
  const { type, year, index = 1, fiscalStartMonth = 1 } = input;

  if (fiscalStartMonth < 1 || fiscalStartMonth > 12) {
    throw new Error(`fiscalStartMonth must be between 1 and 12 (received ${fiscalStartMonth})`);
  }

  if (type === 'month') {
    if (index < 1 || index > 12) {
      throw new Error(`Month index must be between 1 and 12 (received ${index})`);
    }
    const { year: startY, month: startM } = addMonths(year, fiscalStartMonth, index - 1);
    const endDay = lastDayOfMonth(startY, startM);
    return {
      start: formatYmd(startY, startM, 1),
      end: formatYmd(startY, startM, endDay),
      label: `${MONTH_NAMES[startM - 1]} ${startY}`,
      isProRata: true,
    };
  }

  if (type === 'quarter') {
    if (index < 1 || index > 4) {
      throw new Error(`Quarter index must be between 1 and 4 (received ${index})`);
    }
    const startOffset = (index - 1) * 3;
    const { year: startY, month: startM } = addMonths(year, fiscalStartMonth, startOffset);
    const { year: endY, month: endM } = addMonths(year, fiscalStartMonth, startOffset + 2);
    const endDay = lastDayOfMonth(endY, endM);
    return {
      start: formatYmd(startY, startM, 1),
      end: formatYmd(endY, endM, endDay),
      label: `Q${index} ${year}`,
      isProRata: false,
    };
  }

  // type === 'year'
  const { year: startY, month: startM } = addMonths(year, fiscalStartMonth, 0);
  const { year: endY, month: endM } = addMonths(year, fiscalStartMonth, 11);
  const endDay = lastDayOfMonth(endY, endM);
  return {
    start: formatYmd(startY, startM, 1),
    end: formatYmd(endY, endM, endDay),
    label: `${year}`,
    isProRata: false,
  };
}

/**
 * Returns the fiscal quarter (1–4) for a given Date or YYYY-MM-DD string.
 */
export function quarterOf(dateInput: Date | string, fiscalStartMonth = 1): 1 | 2 | 3 | 4 {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date provided to quarterOf');
  }
  const month1Based = d.getUTCMonth() + 1;
  const offset = (month1Based - fiscalStartMonth + 12) % 12;
  return (Math.floor(offset / 3) + 1) as 1 | 2 | 3 | 4;
}
