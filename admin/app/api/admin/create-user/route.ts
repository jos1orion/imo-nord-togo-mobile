import { NextResponse } from 'next/server';
import { recordAdminAction, requireAdmin } from '../../../../lib/adminApiAuth';

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ('error' in guard) return guard.error;
  const { supabaseAdmin, authUserId } = guard;

  let payload: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  const { email, password, full_name, role, phone } = payload ?? {};

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof role !== 'string' ||
    !email.trim() ||
    !password ||
    !role
  ) {
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
  }
  if (password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: 'Mot de passe invalide (6 à 128 caractères).' }, { status: 400 });
  }
  if (!['ADMIN', 'AGENT', 'ACCOUNTANT'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }
  if (full_name !== undefined && (typeof full_name !== 'string' || full_name.length > 200)) {
    return NextResponse.json({ error: 'Nom invalide.' }, { status: 400 });
  }
  if (phone !== undefined && (typeof phone !== 'string' || phone.length > 40)) {
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
    full_name: full_name ?? null,
    phone: phone ?? null,
    role,
    agent_status: role === 'AGENT' ? 'approved' : 'none',
  }, { onConflict: 'id' });

  if (profileError) {
    const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    if (cleanupError) {
      console.error('Admin user cleanup failed after profile creation error', {
        userId: data.user.id,
        error: cleanupError.message,
      });
    }
    return NextResponse.json({ error: 'Profil utilisateur impossible à enregistrer.' }, { status: 400 });
  }

  await recordAdminAction(supabaseAdmin, authUserId, 'create_user', 'user', data.user.id);
  return NextResponse.json({ success: true, userId: data.user.id });
}
