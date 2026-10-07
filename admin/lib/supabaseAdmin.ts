import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'server-only';

let adminClient: SupabaseClient | null = null;

/**
 * Client Supabase avec la clé service role. Initialisation paresseuse pour ne pas
 * casser `next build` lorsque les variables d'environnement ne sont pas définies.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Supabase admin : définissez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY pour cette route API.'
    );
  }
  const isSecretApiKey = serviceKey.startsWith('sb_secret_');
  const isLegacyServiceRoleJwt = (() => {
    const parts = serviceKey.split('.');
    if (parts.length !== 3) return false;
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      return payload.role === 'service_role';
    } catch {
      return false;
    }
  })();
  if (!isSecretApiKey && !isLegacyServiceRoleJwt) {
    throw new Error(
      'Supabase admin : SUPABASE_SERVICE_ROLE_KEY doit être une clé API secrète Supabase (sb_secret_) ou un ancien JWT service_role complet, côté serveur uniquement.'
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
