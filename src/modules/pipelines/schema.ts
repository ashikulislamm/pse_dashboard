import { z } from 'zod';

export const pipelinesIdSchema = z.string().uuid();
