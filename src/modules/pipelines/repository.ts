import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

export async function getPipelinesClient() {
  return createSupabaseServerClient();
}
