import { z } from 'zod';

export const meetingsIdSchema = z.string().uuid();
