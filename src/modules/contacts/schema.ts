import { z } from 'zod';

export const contactsIdSchema = z.string().uuid();
