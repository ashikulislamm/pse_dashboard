import { z } from 'zod';

export const dashboardLensSchema = z.enum(['monetary', 'non_monetary']);
export const dashboardPeriodTypeSchema = z.enum(['month', 'quarter', 'year']);

/** Raw filters as they arrive from the URL; every field is optional and gets a default. */
export const dashboardFilterSchema = z.object({
  period: dashboardPeriodTypeSchema.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  index: z.coerce.number().int().min(1).max(12).optional(),
  member: z.string().uuid().optional(),
  vertical: z.string().uuid().optional(),
  lens: dashboardLensSchema.optional(),
});

export type DashboardLens = z.infer<typeof dashboardLensSchema>;
export type DashboardPeriodType = z.infer<typeof dashboardPeriodTypeSchema>;
export type DashboardFilterInput = z.infer<typeof dashboardFilterSchema>;
