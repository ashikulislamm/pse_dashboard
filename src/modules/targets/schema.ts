import { z } from 'zod';

export const targetsIdSchema = z.string().uuid();
