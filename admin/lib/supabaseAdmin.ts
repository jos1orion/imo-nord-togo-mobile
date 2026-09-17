import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'server-only';

let adminClient: SupabaseClient | null = null;

/**
 * Client Supabase avec la clé service role. Initialisation paresseuse pour ne pas
 * casser `next build` lorsque les variables d'environnement ne sont pas définies.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Supabase admin : définissez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY pour cette route API.'
    );
  }

  adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

