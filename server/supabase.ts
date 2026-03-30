import { createClient } from '@supabase/supabase-js';

function base64UrlDecode(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return Buffer.from(base64 + pad, 'base64').toString('utf8');
}

function getJwtRole(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function createSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  const looksLikeJwt = key.startsWith('eyJ') && key.split('.').length === 3;
  const looksLikeSecret = key.startsWith('sb_secret_');
  if (!looksLikeJwt && !looksLikeSecret) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY looks invalid. Use the Supabase project Secret/service_role key (JWT "eyJ..." or "sb_secret_..."). Do not use "sb_publishable_...".',
    );
  }

  if (looksLikeJwt) {
    const role = getJwtRole(key);
    if (role && role !== 'service_role') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY must be the service_role key (not anon/authenticated)');
    }
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
