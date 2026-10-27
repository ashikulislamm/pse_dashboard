'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Button,
  DatePicker,
  Field,
  Input,
  Money,
  Select,
  Textarea,
} from '@/shared/ui';
import { recordPipelineReceiptAction } from '../actions';
import type { CurrencyOption } from '../repository';
import {
  computeBase,
  computePipelineAchievementSummary,
  resolveFxRate,
  type FxRateOption,
} from '../service';

export interface RecordReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  pipelineId: string;
  dealName: string;
  defaultCurrency?: string;
  expectedAmountBase: number;
  receivedAmountBase: number;
  currencies: CurrencyOption[];
  fxRates: FxRateOption[];
}

export function RecordReceiptDialog(props: RecordReceiptDialogProps) {
  if (!props.open) return null;
  return <RecordReceiptDialogInner {...props} />;
}

function RecordReceiptDialogInner({
  onClose,
  pipelineId,
  dealName,
  defaultCurrency = 'BDT',
  expectedAmountBase,
  receivedAmountBase,
  currencies,
  fxRates,
}: RecordReceiptDialogProps) {
  const router = useRouter();
  const [amountStr, setAmountStr] = React.useState('');
  const [currency, setCurrency] = React.useState(defaultCurrency);
  const [receivedOn, setReceivedOn] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const parsedAmount = Number(amountStr);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  let activeFxRate = 1;
  let computedBase = 0;
  try {
    activeFxRate = resolveFxRate(currency, fxRates, receivedOn);
    if (isValidAmount) {
      computedBase = computeBase(parsedAmount, currency, fxRates, receivedOn);
    }
  } catch {
    activeFxRate = 1;
  }

  const currentSummary = computePipelineAchievementSummary(
    expectedAmountBase,
    receivedAmountBase,
  );
  const projectedSummary = computePipelineAchievementSummary(
    expectedAmountBase,
    receivedAmountBase + computedBase,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidAmount) {
      setError('Enter a receipt amount greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await recordPipelineReceiptAction({
        pipeline_id: pipelineId,
        amount: parsedAmount,
        currency,
        received_on: receivedOn,
        note: note.trim() || null,
      });

      if (res.status === 'error') {
        setError(res.message);
        return;
      }

      toast.success('Realized receipt recorded. Dashboard achievement updated.');
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-receipt-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[480px] rounded-md border border-border bg-background p-6 shadow-[0_4px_16px_rgb(0_0_0/0.08)]"
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2
              id="record-receipt-dialog-title"
              className="text-[16px] leading-6 font-semibold text-foreground"
            >
              Record realized receipt
            </h2>
            <p className="text-[13px] text-muted-foreground">{dealName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-[13px] text-muted-foreground hover:text-foreground outline-none focus:outline-none focus-visible:outline-none"
          >
            Close
          </button>
        </div>

        <div className="mb-4 rounded-sm border border-border bg-surface p-3 text-[12px] leading-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Won expected value:</span>
            <Money
              amount={currentSummary.expectedBase}
              currency="BDT"
              className="font-medium text-foreground"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Received to date:</span>
            <Money
              amount={currentSummary.receivedBase}
              currency="BDT"
              className="font-medium text-foreground"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Remaining unrealized:</span>
            <Money
              amount={currentSummary.unrealizedBase}
              currency="BDT"
              className="font-medium text-foreground"
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-sm border border-negative bg-negative-subtle p-3 text-[13px] text-negative"
          >
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="receipt-amount" label="Receipt amount (> 0)" requiredLabel>
              <Input
                id="receipt-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="tabular-nums"
                required
                autoFocus
              />
            </Field>

            <Field id="receipt-currency" label="Currency" requiredLabel>
              <Select
                id="receipt-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencies.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.code} {cur.name ? `— ${cur.name}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {isValidAmount && (
            <div className="flex items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 text-[13px]">
              <span className="text-muted-foreground">
                Realized achievement (BDT):
              </span>
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Money amount={computedBase} currency="BDT" />
                {currency !== 'BDT' && (
                  <span className="text-[12px] font-normal text-muted-foreground tabular-nums">
                    (1 {currency} = ৳ {activeFxRate.toLocaleString('en-US')})
                  </span>
                )}
              </div>
            </div>
          )}

          {isValidAmount && projectedSummary.isOverReceived && (
            <div className="rounded-sm border border-warning bg-warning-subtle px-3 py-2 text-[12px] text-warning">
              Over-receipt notice: Recording this receipt brings total received above the
              Won expected value by{' '}
              <Money
                amount={projectedSummary.overReceivedBase}
                currency="BDT"
                className="font-semibold"
              />
              . Over-receipt is allowed and will be flagged on the pipeline.
            </div>
          )}

          <Field id="receipt-date" label="Received on" requiredLabel>
            <DatePicker
              id="receipt-date"
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
              required
            />
          </Field>

          <Field id="receipt-note" label="Reference / tranche note" optional>
            <Textarea
              id="receipt-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., First tranche bank wire ref #BRAC-2026-0092"
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Recording…' : 'Record receipt'}
          </Button>
        </div>
      </form>
    </div>
  );
}
