import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

export async function getAuthClient() {
  return createSupabaseServerClient();
}
