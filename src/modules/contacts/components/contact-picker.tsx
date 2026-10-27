'use client';

import * as React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input, Tag } from '@/shared/ui';
import type { ContactType } from '@/types/database';
import type { ContactLiteOption, DuplicateContactMatch } from '../repository';
import { ContactForm } from './contact-form';

export interface ContactPickerProps {
  id?: string;
  options: ContactLiteOption[];
  value: string | null | undefined;
  onChange: (contactId: string, contact?: ContactLiteOption) => void;
  allowedType?: ContactType;
  placeholder?: string;
  companyOptions?: ContactLiteOption[];
  defaultOrganizationId?: string | null;
  allowClear?: boolean;
  hasError?: boolean;
}

/**
 * Reusable ContactPicker combobox with inline contact creation (DESIGN.md §6 & PHASES.md P3).
 * Searches internal PSE contacts by name, type, or organization, and includes a final item
 * "Create new contact" that opens inline inside the picker flow without losing parent form state.
 */
export function ContactPicker({
  id,
  options: initialOptions,
  value,
  onChange,
  allowedType,
  placeholder = 'Select contact…',
  companyOptions = [],
  defaultOrganizationId = null,
  allowClear = false,
  hasError = false,
}: ContactPickerProps) {
  const [createdOptions, setCreatedOptions] = React.useState<ContactLiteOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [creatingInline, setCreatingInline] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const options = React.useMemo(() => {
    const map = new Map<string, ContactLiteOption>();
    for (const opt of createdOptions) {
      map.set(opt.id, opt);
    }
    for (const opt of initialOptions) {
      if (!map.has(opt.id)) {
        map.set(opt.id, opt);
      }
    }
    return Array.from(map.values());
  }, [createdOptions, initialOptions]);

  const filtered = React.useMemo(() => {
    const base = allowedType
      ? options.filter((o) => o.type === allowedType)
      : options;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.organization_name && o.organization_name.toLowerCase().includes(q)) ||
        (o.designation && o.designation.toLowerCase().includes(q)) ||
        (o.primary_channel && o.primary_channel.toLowerCase().includes(q)),
    );
  }, [options, allowedType, query]);

  const selected = options.find((o) => o.id === value);

  const handleCreated = (created: { id: string; name: string; type: ContactType }) => {
    const newOption: ContactLiteOption = {
      id: created.id,
      name: created.name,
      type: created.type,
      organization_id: null,
      organization_name: null,
      designation: null,
      primary_channel: null,
    };
    setCreatedOptions((prev) => [newOption, ...prev]);
    onChange(created.id, newOption);
    setCreatingInline(false);
    setOpen(false);
    setQuery('');
  };

  const handleUseDuplicate = (existing: DuplicateContactMatch) => {
    const found = options.find((o) => o.id === existing.id) ?? {
      id: existing.id,
      name: existing.name,
      type: existing.type,
      organization_id: null,
      organization_name: null,
      designation: null,
      primary_channel: existing.matched_value,
    };
    if (!options.some((o) => o.id === existing.id)) {
      setCreatedOptions((prev) => [found, ...prev]);
    }
    onChange(existing.id, found);
    setCreatingInline(false);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setCreatingInline(false);
        }}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-sm border bg-background px-3 text-left text-[14px] leading-5 text-foreground outline-none focus:outline-none focus-visible:outline-none',
          hasError ? 'border-negative' : 'border-border-strong',
        )}
      >
        <span className={cn('truncate', !selected && 'text-subtle-foreground')}>
          {selected
            ? `${selected.name}${
                selected.organization_name ? ` — ${selected.organization_name}` : ''
              }`
            : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[320px] rounded-md border border-border bg-background p-3 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
          {!creatingInline ? (
            <div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, company, or channel…"
                className="mb-2 h-8 text-[13px]"
                autoFocus
              />

              <ul role="listbox" className="max-h-56 overflow-y-auto">
                {allowClear && value && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onChange('', undefined);
                        setOpen(false);
                        setQuery('');
                      }}
                      className="w-full rounded-sm px-2 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-surface-2"
                    >
                      Clear selection
                    </button>
                  </li>
                )}
                {filtered.length === 0 ? (
                  <li className="px-2 py-2 text-[13px] text-muted-foreground">
                    No matching contacts.
                  </li>
                ) : (
                  filtered.map((opt) => (
                    <li key={opt.id} role="option" aria-selected={opt.id === value}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(opt.id, opt);
                          setOpen(false);
                          setQuery('');
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] leading-5 hover:bg-surface-2',
                          opt.id === value && 'bg-primary-subtle text-primary font-medium',
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{opt.name}</div>
                          {(opt.organization_name || opt.designation || opt.primary_channel) && (
                            <div className="truncate text-[12px] text-muted-foreground">
                              {[opt.designation, opt.organization_name, opt.primary_channel]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </div>
                        <Tag className="shrink-0">{opt.type}</Tag>
                      </button>
                    </li>
                  ))
                )}
              </ul>

              <div className="mt-2 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => setCreatingInline(true)}
                  className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-[13px] font-medium text-primary hover:bg-surface-2"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Create new contact</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                <span className="text-[14px] font-semibold text-foreground">
                  Create new contact
                </span>
                <button
                  type="button"
                  onClick={() => setCreatingInline(false)}
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                >
                  Back to search
                </button>
              </div>
              <ContactForm
                mode="create"
                fixedType={allowedType}
                initialValues={{
                  name: query.trim(),
                  organization_id: defaultOrganizationId,
                }}
                companyOptions={companyOptions}
                compact
                onSuccess={handleCreated}
                onCancel={() => setCreatingInline(false)}
                onSelectDuplicate={handleUseDuplicate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
