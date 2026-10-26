import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

export async function getActivitiesClient() {
  return createSupabaseServerClient();
}
