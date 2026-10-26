import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

export async function getContactsClient() {
  return createSupabaseServerClient();
}
