import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Server-only Supabase admin client using the service-role key.
 * NEVER import this in client components.
 * Used exclusively inside server-side cached aggregate functions AFTER caller authorization (`requireUser()`).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
