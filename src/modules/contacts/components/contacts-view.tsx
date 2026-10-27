'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import {
  Button,
  DataTable,
  DateText,
  FilterBar,
  PageHeader,
  Select,
  Tag,
  type DataTableColumn,
} from '@/shared/ui';
import type { ContactListItem, ContactLiteOption } from '../repository';
import { ContactForm } from './contact-form';

export interface ContactsViewProps {
  contacts: ContactListItem[];
  companies: { id: string; name: string }[];
  industries: string[];
  companyOptions: ContactLiteOption[];
}

export function ContactsView({
  contacts,
  companies,
  industries,
  companyOptions,
}: ContactsViewProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<string>('');
  const [orgFilter, setOrgFilter] = React.useState<string>('');
  const [industryFilter, setIndustryFilter] = React.useState<string>('');
  const [sheetOpen, setSheetOpen] = React.useState(false);

  React.useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  const hasActiveFilters = Boolean(
    search.trim() || typeFilter || statusFilter || orgFilter || industryFilter,
  );

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
    setOrgFilter('');
    setIndustryFilter('');
  };

  const filteredContacts = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (orgFilter && c.organization_id !== orgFilter) return false;
      if (
        industryFilter &&
        (c.industry ?? '').toLowerCase() !== industryFilter.toLowerCase()
      ) {
        return false;
      }
      if (q) {
        const hay = [
          c.name,
          c.organization_name,
          c.designation,
          c.industry,
          c.primary_channel_value,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, typeFilter, statusFilter, orgFilter, industryFilter]);

  const columns = React.useMemo<DataTableColumn<ContactListItem>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        sortValue: (row) => row.name.toLowerCase(),
        render: (row) => (
          <div className="flex flex-col py-1">
            <Link
              href={`/contacts/${row.id}`}
              className="font-medium text-primary hover:underline"
            >
              {row.name}
            </Link>
            {row.designation && (
              <span className="text-[12px] text-muted-foreground">{row.designation}</span>
            )}
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        sortValue: (row) => row.type,
        render: (row) => <Tag>{row.type}</Tag>,
      },
      {
        key: 'organization',
        header: 'Organization / Industry',
        sortable: true,
        sortValue: (row) =>
          (row.organization_name ?? row.industry ?? '').toLowerCase(),
        render: (row) => {
          if (row.type === 'individual') {
            return row.organization_id && row.organization_name ? (
              <Link
                href={`/contacts/${row.organization_id}`}
                className="text-foreground hover:underline"
              >
                {row.organization_name}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          }
          return row.industry ? (
            <span>{row.industry}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        key: 'primary_channel',
        header: 'Primary channel',
        render: (row) =>
          row.primary_channel_value ? (
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums">{row.primary_channel_value}</span>
              {row.channel_count > 1 && (
                <span className="text-[12px] text-muted-foreground">
                  (+{row.channel_count - 1})
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'owner',
        header: 'Owner',
        sortable: true,
        sortValue: (row) => (row.owner_name ?? '').toLowerCase(),
        render: (row) => (
          <span className="text-muted-foreground">{row.owner_name ?? '—'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (row) => row.status,
        render: (row) => <Tag>{row.status}</Tag>,
      },
      {
        key: 'created_at',
        header: 'Added',
        sortable: true,
        sortValue: (row) => row.created_at,
        render: (row) => (
          <DateText value={row.created_at} className="text-muted-foreground" />
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Donors, sponsors, partner organizations, and points of contact."
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New contact
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search name, email, phone, role…"
        searchValue={search}
        onSearchChange={setSearch}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      >
        <Select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 w-36 text-[13px]"
        >
          <option value="">All types</option>
          <option value="individual">Individual</option>
          <option value="company">Company</option>
        </Select>

        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 w-36 text-[13px]"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>

        <Select
          aria-label="Filter by organization"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="h-8 w-48 text-[13px]"
        >
          <option value="">All organizations</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        {industries.length > 0 && (
          <Select
            aria-label="Filter by industry"
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="h-8 w-44 text-[13px]"
          >
            <option value="">All industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </Select>
        )}
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filteredContacts}
        getRowKey={(r) => r.id}
        emptyMessage={
          hasActiveFilters
            ? 'No results for these filters.'
            : 'No contacts yet. Create the first one.'
        }
        emptyActionLabel={hasActiveFilters ? 'Clear filters' : 'New contact'}
        onEmptyAction={hasActiveFilters ? clearFilters : () => setSheetOpen(true)}
      />

      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-contact-sheet-title"
          className="fixed inset-0 z-50 flex justify-end bg-foreground/25"
        >
          <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <h2
                id="new-contact-sheet-title"
                className="text-[18px] leading-7 font-semibold text-foreground"
              >
                New contact
              </h2>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <ContactForm
              mode="create"
              companyOptions={companyOptions}
              onSuccess={(created) => {
                setSheetOpen(false);
                router.push(`/contacts/${created.id}`);
                router.refresh();
              }}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
