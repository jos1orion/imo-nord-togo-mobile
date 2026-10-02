import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';

type AdminApiContext = {
  supabaseAdmin: SupabaseClient;
  userId: string;
};

type AdminApiGuardResult = AdminApiContext | { response: NextResponse };

export async function requireAdminApi(request: Request): Promise<AdminApiGuardResult> {
  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Configuration serveur incomplète.';
    return { response: NextResponse.json({ error: message }, { status: 503 }) };
  }

  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) {
    return { response: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return { response: NextResponse.json({ error: 'Session invalide.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, account_status')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    return { response: NextResponse.json({ error: 'Impossible de vérifier les droits admin.' }, { status: 500 }) };
  }
  if (!profile || profile.role !== 'ADMIN' || profile.account_status === 'suspended') {
    return { response: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }) };
  }

  const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
  if (claimsError || !claimsData || claimsData.claims.aal !== 'aal2') {
    return { response: NextResponse.json({ error: 'Une authentification MFA est requise.' }, { status: 403 }) };
  }

  return { supabaseAdmin, userId: authData.user.id };
}
