import { cn } from '@/shared/lib/utils';
import { Skeleton } from './primitives';

/**
 * Loading-state building blocks (DESIGN.md §6: flat `--surface-2` blocks that match the final
 * layout; no shimmer or pulse). Each composition mirrors a real screen so the page does not
 * jump when data arrives.
 */

/** Wraps a skeleton screen so assistive tech announces a busy region once. */
export function LoadingRegion({
  label = 'Loading',
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-9 w-32 rounded-md" />}
    </div>
  );
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function FilterBarSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {Array.from({ length: fields }, (_, i) => (
        <Skeleton key={i} className={cn('h-9 rounded-sm', i === 0 ? 'w-64' : 'w-36')} />
      ))}
    </div>
  );
}

const CELL_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-1/2', 'w-2/5'];

export function TableSkeleton({
  rows = 8,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-background', className)}>
      <div
        className="grid gap-4 border-b border-border bg-surface px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className="h-3.5 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-4', CELL_WIDTHS[(r + c) % CELL_WIDTHS.length])} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({
  lines = 4,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-border bg-background p-4', className)}>
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn('h-4', CELL_WIDTHS[i % CELL_WIDTHS.length])} />
        ))}
      </div>
    </div>
  );
}

/** List screens: header, optional KPI strip, filters, table. */
export function ListPageSkeleton({
  kpis = 0,
  filters = 4,
  columns = 6,
  rows = 8,
  withAction = true,
}: {
  kpis?: number;
  filters?: number;
  columns?: number;
  rows?: number;
  withAction?: boolean;
}) {
  return (
    <LoadingRegion>
      <PageHeaderSkeleton withAction={withAction} />
      {kpis > 0 && <KpiRowSkeleton count={kpis} />}
      <FilterBarSkeleton fields={filters} />
      <TableSkeleton rows={rows} columns={columns} />
    </LoadingRegion>
  );
}

/** Record detail screens: header, summary cards, a related-records table. */
export function DetailPageSkeleton() {
  return (
    <LoadingRegion>
      <PageHeaderSkeleton />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <CardSkeleton lines={5} className="lg:col-span-2" />
        <CardSkeleton lines={4} />
      </div>
      <div className="mb-4 flex gap-4 border-b border-border pb-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-24" />
        ))}
      </div>
      <TableSkeleton rows={4} columns={5} />
    </LoadingRegion>
  );
}

/** Dashboard: filter bar, lens switch, KPI tiles, chart cards, supporting table. */
export function DashboardSkeleton() {
  return (
    <LoadingRegion>
      <PageHeaderSkeleton withAction={false} />
      <FilterBarSkeleton fields={4} />
      <Skeleton className="mb-6 h-9 w-56 rounded-md" />
      <KpiRowSkeleton count={4} />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-4 h-56 w-full" />
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-56 w-full" />
        </div>
      </div>
      <TableSkeleton rows={5} columns={5} />
    </LoadingRegion>
  );
}

/** Form-style screens (targets wizard, admin). */
export function FormPageSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <LoadingRegion>
      <PageHeaderSkeleton withAction={false} />
      <div className="space-y-4">
        {Array.from({ length: cards }, (_, i) => (
          <CardSkeleton key={i} lines={5} />
        ))}
      </div>
    </LoadingRegion>
  );
}
