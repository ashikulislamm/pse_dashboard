import { z } from 'zod';

export const activityTypeSchema = z.enum([
  'task',
  'email',
  'call',
  'meeting',
  'event',
  'campaign',
  'proposal',
  'visit',
  'servicing',
  'prospect_engagement',
  'general',
]);

export const activityClassSchema = z.enum([
  'stewardship',
  'prospect_engagement',
  'independent',
]);

export const activityStatusSchema = z.enum([
  'planned',
  'in_progress',
  'done',
  'cancelled',
]);

export const activityFormSchema = z.object({
  title: z.string().trim().min(2, 'Enter the activity title.'),
  type: activityTypeSchema,
  class: activityClassSchema.optional(),
  owner_id: z.string().uuid('Select an activity owner.'),
  contact_id: z.string().uuid().nullable().optional(),
  pipeline_id: z.string().uuid().nullable().optional(),
  meeting_id: z.string().uuid().nullable().optional(),
  related_org_name: z.string().trim().max(255).nullable().optional(),
  status: activityStatusSchema.default('planned'),
  remaining_work: z.string().trim().max(5000).nullable().optional(),
  occurred_at: z.string().trim().nullable().optional(),
  due_at: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(10000).nullable().optional(),
});

export type ActivityFormInput = z.infer<typeof activityFormSchema>;

export const activityFilterSchema = z.object({
  q: z.string().trim().optional(),
  type: activityTypeSchema.optional(),
  class: activityClassSchema.optional(),
  status: activityStatusSchema.optional(),
  ownerId: z.string().uuid().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
});

export type ActivityFilters = z.infer<typeof activityFilterSchema>;
