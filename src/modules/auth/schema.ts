import { z } from 'zod';

export const authIdSchema = z.string().uuid();
