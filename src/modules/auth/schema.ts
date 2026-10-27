import { z } from 'zod';

export const appRoleSchema = z.enum(['admin', 'target_manager', 'member']);

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  full_name: z.string().trim().min(2, 'Enter the full name.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: appRoleSchema,
  is_pse: z.boolean().default(true),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: appRoleSchema,
  is_pse: z.boolean(),
  is_active: z.boolean(),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
