import { z } from 'zod';

export const meetingStatusSchema = z.enum(['scheduled', 'done']);

export const meetingFormSchema = z
  .object({
    contact_id: z.string().uuid().nullable().optional(),
    pipeline_id: z.string().uuid().nullable().optional(),
    scheduled_at: z.string().trim().min(10, 'Select a scheduled date and time.'),
    status: meetingStatusSchema.default('scheduled'),
    description: z.string().trim().max(5000).nullable().optional(),
    owner_id: z.string().uuid('Select a meeting owner.'),
  })
  .superRefine((val, ctx) => {
    const hasContact = Boolean(val.contact_id && val.contact_id.trim().length > 0);
    const hasPipeline = Boolean(val.pipeline_id && val.pipeline_id.trim().length > 0);
    if (!hasContact && !hasPipeline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Link the meeting to at least a contact or a pipeline.',
        path: ['contact_id'],
      });
    }
  });

export type MeetingFormInput = z.infer<typeof meetingFormSchema>;

export const meetingFilterSchema = z.object({
  q: z.string().trim().optional(),
  status: meetingStatusSchema.optional(),
  ownerId: z.string().uuid().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
});

export type MeetingFilters = z.infer<typeof meetingFilterSchema>;
