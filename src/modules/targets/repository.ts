import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

export async function getTargetsClient() {
  return createSupabaseServerClient();
}
