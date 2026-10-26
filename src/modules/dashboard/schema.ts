import { z } from 'zod';

export const dashboardIdSchema = z.string().uuid();
