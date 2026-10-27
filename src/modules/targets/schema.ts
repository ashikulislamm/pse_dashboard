import { z } from 'zod';

export const targetYearSchema = z.coerce.number().int().min(2000).max(2100);

const moneySchema = z
  .number({ message: 'Enter a valid amount.' })
  .finite('Enter a valid amount.')
  .min(0, 'Amounts cannot be negative.')
  .max(1_000_000_000_000, 'Amount is too large.');

export const targetVerticalShareSchema = z.object({
  vertical_id: z.string().uuid(),
  percent: z
    .number({ message: 'Enter a valid percentage.' })
    .finite()
    .min(0, 'Percentages cannot be negative.')
    .max(100, 'A percentage cannot exceed 100.'),
});

export const targetAllocationSchema = z.object({
  quarter: z.number().int().min(1).max(4),
  user_id: z.string().uuid(),
  amount: moneySchema,
  verticals: z.array(targetVerticalShareSchema),
});

/**
 * A plan draft as edited in the wizard. Drafts may be incomplete (totals are only enforced on
 * publish), but every individual value must be well-formed.
 */
export const targetPlanDraftSchema = z.object({
  year: targetYearSchema,
  annual_amount: moneySchema.refine((v) => v > 0, 'Annual target must be greater than zero.'),
  quarters: z.array(moneySchema).length(4, 'Enter an amount for each of the four quarters.'),
  allocations: z.array(targetAllocationSchema),
});

export type TargetVerticalShare = z.infer<typeof targetVerticalShareSchema>;
export type TargetAllocation = z.infer<typeof targetAllocationSchema>;
export type TargetPlanDraft = z.infer<typeof targetPlanDraftSchema>;
