import { z } from 'zod';

export const contributionTypeSchema = z.enum(['cash', 'in_kind']);
export const partyTypeSchema = z.enum(['individual', 'company']);
export const paymentIntervalSchema = z.enum([
  'one_time',
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
]);
export const stageKindSchema = z.enum(['open', 'won', 'lost', 'junk']);

export const pipelineFormSchema = z
  .object({
    deal_name: z.string().trim().min(2, 'Enter the deal name.'),
    focal_person_id: z.string().uuid('Select a focal person.'),
    contribution_type: contributionTypeSchema,
    category_id: z.string().uuid('Select a contribution category.'),
    party_type: partyTypeSchema,
    contact_id: z.string().uuid('Select a donor or company contact.'),
    poc_contact_id: z.string().uuid().nullable().optional(),
    secondary_contact_id: z.string().uuid().nullable().optional(),
    stage_id: z.string().uuid('Select a pipeline stage.'),
    expected_amount: z
      .number({ invalid_type_error: 'Enter a valid expected amount greater than 0.' })
      .positive('Expected amount must be greater than 0. Log unvalued items as an Activity.'),
    currency: z.string().trim().min(3).max(3).default('BDT'),
    payment_interval: paymentIntervalSchema.default('one_time'),
    expected_close: z.string().trim().nullable().optional(),
    country: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    operational_budget: z.number().nonnegative().nullable().optional(),
    notes: z.string().trim().max(10000).nullable().optional(),
    in_kind_valuation_note: z.string().trim().max(5000).nullable().optional(),
    lost_reason: z.string().trim().max(5000).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.contribution_type === 'in_kind' &&
      (!val.in_kind_valuation_note || val.in_kind_valuation_note.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter an in-kind valuation note (who valued it and basis).',
        path: ['in_kind_valuation_note'],
      });
    }

    if (
      val.party_type === 'company' &&
      (!val.poc_contact_id || val.poc_contact_id.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a Point of Contact (POC) for company pipelines.',
        path: ['poc_contact_id'],
      });
    }
  });

export type PipelineFormInput = z.infer<typeof pipelineFormSchema>;

export const changeStageInputSchema = z.object({
  pipeline_id: z.string().uuid('Invalid pipeline ID.'),
  to_stage_id: z.string().uuid('Select a target stage.'),
  reason: z.string().trim().max(5000).nullable().optional(),
});

export type ChangeStageInput = z.infer<typeof changeStageInputSchema>;

export const recordReceiptInputSchema = z.object({
  pipeline_id: z.string().uuid('Invalid pipeline ID.'),
  amount: z
    .number({ invalid_type_error: 'Enter a valid receipt amount greater than 0.' })
    .positive('Receipt amount must be greater than 0.'),
  currency: z.string().trim().min(3).max(3).default('BDT'),
  received_on: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid receipt date (YYYY-MM-DD).'),
  note: z.string().trim().max(5000).nullable().optional(),
});

export type RecordReceiptInput = z.infer<typeof recordReceiptInputSchema>;

export const pipelineFilterSchema = z.object({
  q: z.string().trim().optional(),
  stageId: z.string().uuid().optional(),
  stageKind: stageKindSchema.optional(),
  categoryId: z.string().uuid().optional(),
  focalPersonId: z.string().uuid().optional(),
  partyType: partyTypeSchema.optional(),
  contributionType: contributionTypeSchema.optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  view: z.enum(['list', 'board']).optional(),
});

export type PipelineFilters = z.infer<typeof pipelineFilterSchema>;
