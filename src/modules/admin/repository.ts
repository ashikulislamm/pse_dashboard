import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

export async function getAdminClient() {
  return createSupabaseServerClient();
}
