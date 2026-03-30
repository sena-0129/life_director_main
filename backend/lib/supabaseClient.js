import { createClient } from '@supabase/supabase-js';
import { loadEnv, requireEnv } from '../config/env.js';

export function createSupabaseAdminClient() {
  loadEnv();
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
