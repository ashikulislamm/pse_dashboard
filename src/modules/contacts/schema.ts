import { z } from 'zod';
import { normalizeEmail, normalizePhone } from '@/shared/lib/phone';

export const contactTypeSchema = z.enum(['individual', 'company']);
export const contactStatusSchema = z.enum(['active', 'inactive']);
export const channelKindSchema = z.enum(['email', 'phone']);

export const contactChannelInputSchema = z
  .object({
    kind: channelKindSchema,
    value: z.string().trim().min(1, 'Enter an email address or phone number.'),
    is_primary: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'email') {
      if (!normalizeEmail(val.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid email address: "${val.value}".`,
          path: ['value'],
        });
      }
    } else if (val.kind === 'phone') {
      if (!normalizePhone(val.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid phone number: "${val.value}". Use a valid local or international number.`,
          path: ['value'],
        });
      }
    }
  });

export type ContactChannelInput = z.infer<typeof contactChannelInputSchema>;

export const contactFormSchema = z.object({
  type: contactTypeSchema,
  name: z.string().trim().min(2, 'Enter the contact name.'),
  organization_id: z.string().uuid().nullable().optional(),
  designation: z.string().trim().max(160).nullable().optional(),
  website: z.string().trim().max(255).nullable().optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(10000).nullable().optional(),
  status: contactStatusSchema.default('active'),
  channels: z
    .array(contactChannelInputSchema)
    .min(1, 'Add at least one email address or phone number.'),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const contactFilterSchema = z.object({
  q: z.string().trim().optional(),
  type: contactTypeSchema.optional(),
  status: contactStatusSchema.optional(),
  organizationId: z.string().uuid().optional(),
  industry: z.string().trim().optional(),
});

export type ContactFilters = z.infer<typeof contactFilterSchema>;
