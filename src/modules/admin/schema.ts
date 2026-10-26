import { z } from 'zod';

export const adminIdSchema = z.string().uuid();
