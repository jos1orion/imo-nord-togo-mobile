import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';
import { fetchStaffProfileAccess } from './profileAccess';

type AdminGuardResult =
  | { supabaseAdmin: SupabaseClient; authUserId: string }
  | { error: NextResponse };

export async function requireAdmin(request: Request): Promise<AdminGuardResult> {
  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Configuration serveur incomplète : SUPABASE_SERVICE_ROLE_KEY est requise pour créer ou modifier des utilisateurs.';
    return {
      error: NextResponse.json({ error: message }, { status: 503 }),
    };
  }

  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!tokenMatch) {
    return { error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(tokenMatch[1]);
  if (authError || !authData.user) {
    return { error: NextResponse.json({ error: 'Session invalide.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await fetchStaffProfileAccess(
    supabaseAdmin,
    authData.user.id
  );

  if (profileError) {
    console.error('Admin profile lookup failed', profileError.message);
    return {
      error: NextResponse.json(
        { error: 'Impossible de vérifier les droits admin.' },
        { status: 500 }
      ),
    };
  }
  if (!profile || profile.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }) };
  }
  if (profile.account_status === 'suspended') {
    return { error: NextResponse.json({ error: 'Compte suspendu.' }, { status: 403 }) };
  }

  return { supabaseAdmin, authUserId: authData.user.id };
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

export async function recordAdminAction(
  supabaseAdmin: SupabaseClient,
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from('activity_logs').insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId ?? null,
  });
  if (error) {
    console.error('Admin audit log failed', {
      actorId,
      action,
      entity,
      entityId,
      error: error.message,
    });
  }
}
