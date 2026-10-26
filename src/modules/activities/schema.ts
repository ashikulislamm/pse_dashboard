import { z } from 'zod';

export const activitiesIdSchema = z.string().uuid();
