import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';
import { fetchStaffProfileAccess } from './profileAccess';

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
    return {
      response: NextResponse.json({ error: message }, { status: 503 }),
    };
  }

  const authorization = request.headers.get('authorization')?.trim();
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) {
    return { response: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return { response: NextResponse.json({ error: 'Session invalide.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await fetchStaffProfileAccess(
    supabaseAdmin,
    authData.user.id
  );

  if (profileError) {
    console.error('Admin profile lookup failed', profileError.message);
    return {
      response: NextResponse.json(
        { error: 'Impossible de vérifier les droits admin.' },
        { status: 500 }
      ),
    };
  }
  if (!profile || profile.role !== 'ADMIN' || profile.account_status === 'suspended') {
    const message = profile?.account_status === 'suspended' ? 'Compte suspendu.' : 'Accès refusé.';
    return { response: NextResponse.json({ error: message }, { status: 403 }) };
  }

  return { supabaseAdmin, userId: authData.user.id };
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
