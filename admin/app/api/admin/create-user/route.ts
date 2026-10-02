import { NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../lib/requireAdminApi';

export async function POST(request: Request) {
  const guard = await requireAdminApi(request);
  if ('response' in guard) return guard.response;
  const { supabaseAdmin } = guard;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  const full_name = body.full_name;
  const role = body.role;
  const phone = body.phone;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 6 || password.length > 256) {
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 });
  }

  if (typeof role !== 'string' || !['ADMIN', 'AGENT', 'ACCOUNTANT'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }
  if (full_name !== undefined && full_name !== null && (typeof full_name !== 'string' || full_name.length > 120)) {
    return NextResponse.json({ error: 'Nom invalide.' }, { status: 400 });
  }
  if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 40)) {
    return NextResponse.json({ error: 'Téléphone invalide.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return NextResponse.json({ error: 'Création du compte impossible.' }, { status: 400 });
  }

  // The database may already create a USER profile through an auth trigger.
  // Upsert keeps account creation idempotent and applies the role selected by the admin.
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: data.user.id,
    full_name: typeof full_name === 'string' ? full_name.trim() || null : null,
    phone: typeof phone === 'string' ? phone.trim() || null : null,
    role,
    agent_status: role === 'AGENT' ? 'approved' : 'none',
  }, { onConflict: 'id' });

  if (profileError) {
    let cleanupError: string | null = null;
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      cleanupError = error?.message ?? null;
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : 'Erreur inconnue';
    }
    if (cleanupError) {
      console.error('Failed to clean up the auth user after profile creation failed.', cleanupError);
    }
    return NextResponse.json({
      error: cleanupError
        ? `Profil non créé (${profileError.message}); suppression du compte auth impossible (${cleanupError}).`
        : `Profil non créé (${profileError.message}); compte auth annulé.`,
    }, { status: 500 });
  }

  await recordAdminAction(supabaseAdmin, authUserId, 'create_user', 'user', data.user.id);
  return NextResponse.json({ success: true, userId: data.user.id });
}
