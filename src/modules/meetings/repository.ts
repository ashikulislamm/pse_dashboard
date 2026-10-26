import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

export async function getMeetingsClient() {
  return createSupabaseServerClient();
}
