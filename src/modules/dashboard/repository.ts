import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

export async function getDashboardClient() {
  return createSupabaseServerClient();
}
