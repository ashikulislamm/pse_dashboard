'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  Moon,
  Search,
  Settings,
  Sun,
  Target,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { AppRole } from '@/types/database';
import { Button, EmptyState, Input } from './primitives';

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  children?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  searchPlaceholder = 'Search…',
  searchValue,
  onSearchChange,
  onClearFilters,
  hasActiveFilters,
  children,
  rightSlot,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-2',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <div className="relative w-60">
            <Search
              className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-[13px]"
            />
          </div>
        )}
        {children}
        {hasActiveFilters && onClearFilters && (
          <Button variant="ghost" size="compact" onClick={onClearFilters}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>
      {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
        <h2 id="confirm-dialog-title" className="text-[18px] leading-7 font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[14px] leading-5 text-muted-foreground">{description}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'primary' : 'primary'}
            className={cn(destructive && 'bg-negative text-white hover:bg-negative/90')}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface ComboboxOption {
  value: string;
  label: string;
  subtitle?: string;
}

export interface ComboboxProps {
  id?: string;
  options: ComboboxOption[];
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  footerActionLabel?: string;
  onFooterAction?: () => void;
  hasError?: boolean;
}

export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  footerActionLabel,
  onFooterAction,
  hasError,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const selected = options.find((o) => o.value === value);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subtitle && o.subtitle.toLowerCase().includes(q)),
    );
  }, [options, query]);

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-sm border bg-background px-3 text-left text-[14px] leading-5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          hasError ? 'border-negative' : 'border-border-strong',
        )}
      >
        <span className={cn(!selected && 'text-subtle-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-md border border-border bg-background p-2 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="mb-2 h-8 text-[13px]"
            autoFocus
          />
          <ul role="listbox" className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-[13px] text-muted-foreground">No matches found.</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value} role="option" aria-selected={opt.value === value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-[13px] leading-5 hover:bg-surface-2',
                      opt.value === value && 'bg-primary-subtle text-primary font-medium',
                    )}
                  >
                    <span>{opt.label}</span>
                    {opt.subtitle && (
                      <span className="text-[12px] text-muted-foreground">{opt.subtitle}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
          {footerActionLabel && onFooterAction && (
            <div className="mt-1 border-t border-border pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onFooterAction();
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-[13px] font-medium text-primary hover:bg-surface-2"
              >
                {footerActionLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  hasError?: boolean;
  includeTime?: boolean;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ includeTime = false, hasError, className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type={includeTime ? 'datetime-local' : 'date'}
        hasError={hasError}
        className={cn('tabular-nums', className)}
        {...props}
      />
    );
  },
);
DatePicker.displayName = 'DatePicker';

export interface DataTableColumn<TRow> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  render: (row: TRow) => React.ReactNode;
  sortValue?: (row: TRow) => string | number;
}

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getRowKey: (row: TRow) => string;
  pageSize?: number;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  compact?: boolean;
}

export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  pageSize = 25,
  emptyMessage = 'No records found.',
  emptyActionLabel,
  onEmptyAction,
  compact = false,
}: DataTableProps<TRow>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortAsc, setSortAsc] = React.useState(true);
  const [page, setPage] = React.useState(1);

  const sortedRows = React.useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return rows;

    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortAsc, columns]);

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedRows = sortedRows.slice(startIdx, startIdx + pageSize);

  if (rows.length === 0) {
    return (
      <EmptyState
        message={emptyMessage}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-md border border-border bg-background">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px] leading-5">
          <thead className="sticky top-0 bg-surface text-muted-foreground">
            <tr className="border-b border-border">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      'px-3 py-2.5 font-medium select-none',
                      col.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {col.sortable && col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isSorted) {
                            setSortAsc((prev) => !prev);
                          } else {
                            setSortKey(col.key);
                            setSortAsc(true);
                          }
                        }}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <span>{col.header}</span>
                        {isSorted &&
                          (sortAsc ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          ))}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'border-b border-border last:border-b-0 hover:bg-surface-2',
                  compact ? 'h-10' : 'h-11',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3',
                      col.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between border-t border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground tabular-nums">
          <span>
            Showing {startIdx + 1}–{Math.min(startIdx + pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="compact"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="compact"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/pipelines', label: 'Pipelines', icon: FolderKanban },
  { href: '/meetings', label: 'Meetings', icon: Calendar },
  { href: '/activities', label: 'Activities', icon: CheckSquare },
  { href: '/targets', label: 'Targets', icon: Target },
  { href: '/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
];

export interface AppShellProps {
  user?: {
    fullName: string;
    role: AppRole;
  } | null;
  onSignOut?: () => void;
  children: React.ReactNode;
}

/**
 * App shell (DESIGN.md §5 App shell):
 * Left sidebar 232px (`--surface`, 1px right border), top bar 56px (breadcrumb left, user + theme toggle right).
 */
export function AppShell({ user, onSignOut, children }: AppShellProps) {
  const pathname = usePathname() || '/dashboard';
  const [dark, setDark] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('pse-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return stored ? stored === 'dark' : prefersDark;
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  }, [dark]);

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    window.localStorage.setItem('pse-theme', nextDark ? 'dark' : 'light');
  };

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  const currentSection =
    NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ?? 'Dashboard';

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/dashboard" className="text-[14px] leading-5 font-semibold text-foreground">
            PSE CRM
          </Link>
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 p-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] leading-5 font-medium transition-colors duration-100',
                  active
                    ? 'bg-primary-subtle text-primary'
                    : 'text-foreground hover:bg-surface-2',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
          <div className="text-[13px] leading-5 font-medium text-muted-foreground">
            PSE / <span className="text-foreground">{currentSection}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="compact"
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {dark ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{dark ? 'Light' : 'Dark'}</span>
            </Button>
            {user && (
              <div className="flex items-center gap-2 border-l border-border pl-3 text-[13px] leading-5">
                <span className="font-medium text-foreground">{user.fullName}</span>
                <span className="text-muted-foreground">({user.role})</span>
                {onSignOut && (
                  <Button variant="secondary" size="compact" onClick={onSignOut}>
                    Sign out
                  </Button>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
