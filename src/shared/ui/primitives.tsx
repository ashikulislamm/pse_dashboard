import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'compact';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent',
  secondary: 'bg-transparent text-foreground border border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-foreground border border-transparent hover:bg-surface-2',
  destructive:
    'bg-transparent text-negative border border-border-strong hover:bg-surface-2',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  default: 'h-9 px-3 text-[14px] leading-5',
  compact: 'h-8 px-2.5 text-[13px] leading-5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'default',
      loading = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-100 outline-none focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
          BUTTON_VARIANTS[variant],
          BUTTON_SIZES[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-sm border bg-background px-3 text-[14px] leading-5 text-foreground outline-none placeholder:text-subtle-foreground focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60',
          hasError ? 'border-negative' : 'border-border-strong',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'h-9 w-full rounded-sm border bg-background px-3 text-[14px] leading-5 text-foreground outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60',
          hasError ? 'border-negative' : 'border-border-strong',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, rows = 6, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'w-full rounded-sm border bg-background p-3 text-[14px] leading-5 text-foreground outline-none placeholder:text-subtle-foreground focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60',
          hasError ? 'border-negative' : 'border-border-strong',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;

/**
 * Renders plain notes text while safely turning http/https URLs (such as Google Drive links)
 * into clickable anchor tags with `target="_blank" rel="noopener noreferrer"`.
 */
export function AutoLinkedNotes({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) {
    return <span className="text-muted-foreground">—</span>;
  }

  const parts = text.split(URL_REGEX);
  return (
    <p className={cn('max-w-[72ch] whitespace-pre-wrap text-[14px] leading-5', className)}>
      {parts.map((part, idx) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={idx}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary-hover"
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </p>
  );
}

export interface FieldProps {
  id: string;
  label: string;
  optional?: boolean;
  requiredLabel?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  id,
  label,
  optional,
  requiredLabel,
  helperText,
  error,
  children,
  className,
}: FieldProps) {
  const descriptionId = error ? `${id}-error` : helperText ? `${id}-helper` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] leading-5 font-medium text-foreground">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
        {requiredLabel && (
          <span className="ml-1 font-normal text-muted-foreground">(required)</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={descriptionId} role="alert" className="text-[12px] leading-4 text-negative">
          {error}
        </p>
      ) : helperText ? (
        <p id={descriptionId} className="text-[12px] leading-4 text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-b border-border pb-6 last:border-b-0 last:pb-0', className)}>
      <div className="mb-4">
        <h3 className="text-[14px] leading-5 font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export type TagTone = 'neutral' | 'positive' | 'negative';

/**
 * Outlined record-state tag (DESIGN.md §6 Tags).
 * Neutral 1px border, 12px text, 4px radius, no fill.
 * Only outcomes get text color: Won -> positive, Lost -> negative.
 */
export function Tag({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: TagTone;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-positive'
      : tone === 'negative'
        ? 'text-negative'
        : 'text-foreground';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-border-strong px-2 py-0.5 text-[12px] leading-4 font-normal',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Static skeleton block (DESIGN.md §2 & §6: flat --surface-2, no shimmer/pulse).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-sm bg-surface-2', className)} />;
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
  actionHref,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-md border border-border bg-background p-6 sm:flex-row sm:items-center">
      <p className="text-[14px] leading-5 text-muted-foreground">{message}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="compact" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {actionLabel && actionHref && !onAction && (
        <a
          href={actionHref}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border-strong px-2.5 text-[13px] leading-5 font-medium text-foreground hover:bg-surface-2"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-[24px] leading-8 font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-[14px] leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  compact = false,
  children,
  className,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-background',
        compact ? 'p-4' : 'p-6',
        className,
      )}
    >
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-[14px] leading-5 font-semibold text-foreground">{title}</h2>
          )}
          {description && (
            <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
