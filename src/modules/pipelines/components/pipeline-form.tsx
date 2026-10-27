'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ContactPicker, type ContactLiteOption } from '@/modules/contacts';
import {
  Button,
  DatePicker,
  Field,
  FormSection,
  Input,
  Money,
  Select,
  Tag,
  Textarea,
} from '@/shared/ui';
import type { ContributionType, PartyType, PaymentInterval } from '@/types/database';
import { createPipelineAction, updatePipelineAction } from '../actions';
import type { PipelineReferenceData } from '../repository';
import type { PipelineFormInput } from '../schema';
import { computeBase, resolveFxRate } from '../service';

export interface PipelineFormProps {
  mode: 'create' | 'edit';
  pipelineId?: string;
  currentUserId: string;
  referenceData: PipelineReferenceData;
  contactOptions: ContactLiteOption[];
  initialValues?: Partial<PipelineFormInput>;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

const PAYMENT_INTERVAL_LABELS: Record<PaymentInterval, string> = {
  one_time: 'One-time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-annual',
  annual: 'Annual',
};

export function PipelineForm({
  mode,
  pipelineId,
  currentUserId,
  referenceData,
  contactOptions,
  initialValues,
  onSuccess,
  onCancel,
}: PipelineFormProps) {
  const defaultStageId =
    initialValues?.stage_id ??
    referenceData.stages.find((s) => s.kind === 'open')?.id ??
    referenceData.stages[0]?.id ??
    '';

  const defaultCategoryId =
    initialValues?.category_id ?? referenceData.categories[0]?.id ?? '';

  const [dealName, setDealName] = React.useState(initialValues?.deal_name ?? '');
  const [focalPersonId, setFocalPersonId] = React.useState(
    initialValues?.focal_person_id ?? currentUserId,
  );
  const [contributionType, setContributionType] = React.useState<ContributionType>(
    initialValues?.contribution_type ?? 'cash',
  );
  const [categoryId, setCategoryId] = React.useState(defaultCategoryId);
  const [partyType, setPartyType] = React.useState<PartyType>(
    initialValues?.party_type ?? 'company',
  );
  const [contactId, setContactId] = React.useState(initialValues?.contact_id ?? '');
  const [pocContactId, setPocContactId] = React.useState(
    initialValues?.poc_contact_id ?? '',
  );
  const [secondaryContactId, setSecondaryContactId] = React.useState(
    initialValues?.secondary_contact_id ?? '',
  );
  const [stageId, setStageId] = React.useState(defaultStageId);
  const [expectedAmountStr, setExpectedAmountStr] = React.useState(
    initialValues?.expected_amount !== undefined
      ? String(initialValues.expected_amount)
      : '',
  );
  const [currency, setCurrency] = React.useState(initialValues?.currency ?? 'BDT');
  const [paymentInterval, setPaymentInterval] = React.useState<PaymentInterval>(
    initialValues?.payment_interval ?? 'one_time',
  );
  const [expectedClose, setExpectedClose] = React.useState(
    initialValues?.expected_close ?? '',
  );
  const [country, setCountry] = React.useState(initialValues?.country ?? 'Bangladesh');
  const [description, setDescription] = React.useState(initialValues?.description ?? '');
  const [operationalBudgetStr, setOperationalBudgetStr] = React.useState(
    initialValues?.operational_budget !== undefined &&
      initialValues?.operational_budget !== null
      ? String(initialValues.operational_budget)
      : '',
  );
  const [notes, setNotes] = React.useState(initialValues?.notes ?? '');
  const [inKindValuationNote, setInKindValuationNote] = React.useState(
    initialValues?.in_kind_valuation_note ?? '',
  );
  const [lostReason, setLostReason] = React.useState(initialValues?.lost_reason ?? '');

  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const companyOptions = React.useMemo(
    () => contactOptions.filter((c) => c.type === 'company'),
    [contactOptions],
  );

  const selectedCategory = referenceData.categories.find((c) => c.id === categoryId);
  const selectedStage = referenceData.stages.find((s) => s.id === stageId);

  const parsedExpectedAmount = Number(expectedAmountStr);
  const isValidAmount = Number.isFinite(parsedExpectedAmount) && parsedExpectedAmount > 0;

  const activeFxRate = React.useMemo(() => {
    try {
      return resolveFxRate(currency, referenceData.fxRates);
    } catch {
      return 1;
    }
  }, [currency, referenceData.fxRates]);

  const computedBaseAmount = React.useMemo(() => {
    if (!isValidAmount) return 0;
    try {
      return computeBase(parsedExpectedAmount, currency, referenceData.fxRates);
    } catch {
      return 0;
    }
  }, [isValidAmount, parsedExpectedAmount, currency, referenceData.fxRates]);

  const handlePartyTypeChange = (nextPartyType: PartyType) => {
    setPartyType(nextPartyType);
    const currentContact = contactOptions.find((c) => c.id === contactId);
    if (currentContact && currentContact.type !== nextPartyType) {
      setContactId('');
    }
    if (nextPartyType === 'individual') {
      setPocContactId('');
      setSecondaryContactId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidAmount) {
      setError(
        'Expected amount must be greater than 0. Small or unvalued items should be logged as an Activity.',
      );
      return;
    }

    const parsedOperationalBudget =
      operationalBudgetStr.trim().length > 0 ? Number(operationalBudgetStr) : null;

    const payload: PipelineFormInput = {
      deal_name: dealName,
      focal_person_id: focalPersonId,
      contribution_type: contributionType,
      category_id: categoryId,
      party_type: partyType,
      contact_id: contactId,
      poc_contact_id: partyType === 'company' ? pocContactId || null : null,
      secondary_contact_id:
        partyType === 'company' ? secondaryContactId || null : null,
      stage_id: stageId,
      expected_amount: parsedExpectedAmount,
      currency,
      payment_interval: paymentInterval,
      expected_close: expectedClose || null,
      country: country || null,
      description: description || null,
      operational_budget:
        parsedOperationalBudget !== null && Number.isFinite(parsedOperationalBudget)
          ? parsedOperationalBudget
          : null,
      notes: notes || null,
      in_kind_valuation_note:
        contributionType === 'in_kind' ? inKindValuationNote || null : null,
      lost_reason:
        selectedStage?.kind === 'lost' || selectedStage?.kind === 'junk'
          ? lostReason || null
          : null,
    };

    setSubmitting(true);
    try {
      const res =
        mode === 'create'
          ? await createPipelineAction(payload)
          : await updatePipelineAction(pipelineId!, payload);

      if (res.status === 'error') {
        setError(res.message);
        return;
      }

      toast.success(mode === 'create' ? 'Pipeline created.' : 'Pipeline updated.');
      onSuccess?.(res.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-md border border-border bg-surface p-3 text-[13px] leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">Money-only rule:</span> Pipelines
        exist strictly for opportunities with expected monetary value (&gt; 0). Small or
        unvalued items →{' '}
        <Link href="/activities" className="font-medium text-primary hover:underline">
          log as an Activity
        </Link>
        .
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-negative bg-negative-subtle p-3 text-[13px] text-negative"
        >
          {error}
        </div>
      )}

      <FormSection
        title="Opportunity details"
        description="Deal name, PSE focal person, stage, and contribution category."
      >
        <div className="sm:col-span-2">
          <Field id="pipeline-deal-name" label="Deal name" requiredLabel>
            <Input
              id="pipeline-deal-name"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              placeholder="e.g., Apex Footwear — Q1 Youth Skills CSR Partnership"
              required
            />
          </Field>
        </div>

        <Field id="pipeline-focal-person" label="Focal person" requiredLabel>
          <Select
            id="pipeline-focal-person"
            value={focalPersonId}
            onChange={(e) => setFocalPersonId(e.target.value)}
            required
          >
            {referenceData.focalPeople.map((fp) => (
              <option key={fp.id} value={fp.id}>
                {fp.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="pipeline-stage" label="Pipeline stage" requiredLabel>
          <Select
            id="pipeline-stage"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            required
          >
            {referenceData.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field
            id="pipeline-category"
            label="Contribution category"
            requiredLabel
            helperText={
              selectedCategory
                ? `Mapped reporting vertical: ${selectedCategory.vertical_name}`
                : undefined
            }
          >
            <div className="flex items-center gap-3">
              <Select
                id="pipeline-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex-1"
                required
              >
                {referenceData.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.vertical_name})
                  </option>
                ))}
              </Select>
              {selectedCategory && (
                <Tag className="shrink-0">
                  Vertical: {selectedCategory.vertical_name}
                </Tag>
              )}
            </div>
          </Field>
        </div>

        {(selectedStage?.kind === 'lost' || selectedStage?.kind === 'junk') && (
          <div className="sm:col-span-2">
            <Field
              id="pipeline-lost-reason"
              label={
                selectedStage.kind === 'lost'
                  ? 'Lost reason'
                  : 'Abandoned reason'
              }
              requiredLabel={selectedStage.kind === 'lost'}
              optional={selectedStage.kind === 'junk'}
            >
              <Input
                id="pipeline-lost-reason"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Specify why this opportunity was lost or abandoned…"
                required={selectedStage.kind === 'lost'}
              />
            </Field>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Financial valuation"
        description="Expected contribution value, currency conversion to BDT, and payment schedule."
      >
        <div className="flex items-center gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={() => setContributionType('cash')}
            className={`h-8 rounded-sm border px-3 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
              contributionType === 'cash'
                ? 'border-primary bg-primary-subtle text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            Cash contribution
          </button>
          <button
            type="button"
            onClick={() => setContributionType('in_kind')}
            className={`h-8 rounded-sm border px-3 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
              contributionType === 'in_kind'
                ? 'border-primary bg-primary-subtle text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            In-kind (valued)
          </button>
        </div>

        <Field
          id="pipeline-expected-amount"
          label="Expected amount (> 0)"
          requiredLabel
        >
          <Input
            id="pipeline-expected-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={expectedAmountStr}
            onChange={(e) => setExpectedAmountStr(e.target.value)}
            placeholder="0.00"
            className="tabular-nums"
            required
          />
        </Field>

        <Field id="pipeline-currency" label="Currency" requiredLabel>
          <Select
            id="pipeline-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {referenceData.currencies.map((cur) => (
              <option key={cur.code} value={cur.code}>
                {cur.code} {cur.name ? `— ${cur.name}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field id="pipeline-interval" label="Payment interval" requiredLabel>
            <Select
              id="pipeline-interval"
              value={paymentInterval}
              onChange={(e) => setPaymentInterval(e.target.value as PaymentInterval)}
            >
              {(Object.keys(PAYMENT_INTERVAL_LABELS) as PaymentInterval[]).map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_INTERVAL_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {isValidAmount && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-[13px] sm:col-span-2">
            <span className="text-muted-foreground">
              Computed base value (stored in BDT):
            </span>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Money amount={computedBaseAmount} currency="BDT" />
              {currency !== 'BDT' && (
                <span className="text-[12px] font-normal text-muted-foreground tabular-nums">
                  (1 {currency} = ৳ {activeFxRate.toLocaleString('en-US')})
                </span>
              )}
            </div>
          </div>
        )}

        {contributionType === 'in_kind' && (
          <div className="sm:col-span-2">
            <Field
              id="pipeline-inkind-note"
              label="In-kind valuation note (Who valued it & basis)"
              requiredLabel
              helperText="Required for all in-kind pipelines. Unvalued items must be logged as an Activity instead."
            >
              <Textarea
                id="pipeline-inkind-note"
                value={inKindValuationNote}
                onChange={(e) => setInKindValuationNote(e.target.value)}
                placeholder="e.g., Valued by PSE Procurement & Donor Supply Chain team based on commercial invoice #INV-2026-44."
                required
              />
            </Field>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Donor / Company & contacts"
        description="Select whether this opportunity is with a company or an individual donor."
      >
        <div className="flex items-center gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={() => handlePartyTypeChange('company')}
            className={`h-8 rounded-sm border px-3 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
              partyType === 'company'
                ? 'border-primary bg-primary-subtle text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            Company / Organization
          </button>
          <button
            type="button"
            onClick={() => handlePartyTypeChange('individual')}
            className={`h-8 rounded-sm border px-3 text-[13px] font-medium outline-none focus:outline-none focus-visible:outline-none ${
              partyType === 'individual'
                ? 'border-primary bg-primary-subtle text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            Individual donor
          </button>
        </div>

        {partyType === 'individual' ? (
          <div className="sm:col-span-2">
            <Field
              id="pipeline-individual-contact"
              label="Individual donor contact"
              requiredLabel
              helperText="Search existing individuals or click '+ Create new contact' inside the dropdown."
            >
              <ContactPicker
                id="pipeline-individual-contact"
                options={contactOptions}
                companyOptions={companyOptions}
                allowedType="individual"
                value={contactId}
                onChange={(id) => setContactId(id)}
                placeholder="Select individual donor…"
              />
            </Field>
          </div>
        ) : (
          <>
            <div className="sm:col-span-2">
              <Field
                id="pipeline-company-contact"
                label="Company contact"
                requiredLabel
                helperText="Select the partner organization or create it inline."
              >
                <ContactPicker
                  id="pipeline-company-contact"
                  options={contactOptions}
                  companyOptions={companyOptions}
                  allowedType="company"
                  value={contactId}
                  onChange={(id) => setContactId(id)}
                  placeholder="Select company…"
                />
              </Field>
            </div>

            <Field
              id="pipeline-poc-contact"
              label="Point of Contact (POC)"
              requiredLabel
              helperText="Primary individual contact for this company deal."
            >
              <ContactPicker
                id="pipeline-poc-contact"
                options={contactOptions}
                companyOptions={companyOptions}
                allowedType="individual"
                defaultOrganizationId={contactId || null}
                value={pocContactId}
                onChange={(id) => setPocContactId(id)}
                placeholder="Select Point of Contact…"
              />
            </Field>

            <Field
              id="pipeline-secondary-contact"
              label="Secondary contact"
              optional
              helperText="Optional backup contact person."
            >
              <ContactPicker
                id="pipeline-secondary-contact"
                options={contactOptions}
                companyOptions={companyOptions}
                allowedType="individual"
                defaultOrganizationId={contactId || null}
                allowClear
                value={secondaryContactId}
                onChange={(id) => setSecondaryContactId(id)}
                placeholder="Select secondary contact (optional)…"
              />
            </Field>
          </>
        )}
      </FormSection>

      <FormSection
        title="Schedule, budget & documentation"
        description="Expected close date, operational budget, and Google Drive links or notes."
      >
        <Field id="pipeline-expected-close" label="Expected close date" optional>
          <DatePicker
            id="pipeline-expected-close"
            value={expectedClose}
            onChange={(e) => setExpectedClose(e.target.value)}
          />
        </Field>

        <Field
          id="pipeline-op-budget"
          label="Operational budget (BDT)"
          optional
        >
          <Input
            id="pipeline-op-budget"
            type="number"
            min="0"
            step="0.01"
            value={operationalBudgetStr}
            onChange={(e) => setOperationalBudgetStr(e.target.value)}
            placeholder="0.00"
            className="tabular-nums"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field id="pipeline-country" label="Country" optional>
            <Input
              id="pipeline-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Bangladesh"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            id="pipeline-description"
            label="Proposal / scope description"
            optional
          >
            <Textarea
              id="pipeline-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize the partnership scope, deliverables, or grant objective…"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            id="pipeline-notes"
            label="Notes & Google Drive links"
            optional
            helperText="Paste Google Drive folder or MoU URLs here; they render as clickable links on the detail view."
          >
            <Textarea
              id="pipeline-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Signed MoU & Budget Sheet: https://drive.google.com/drive/folders/..."
            />
          </Field>
        </div>
      </FormSection>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting
            ? 'Saving…'
            : mode === 'create'
              ? 'Create pipeline'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
